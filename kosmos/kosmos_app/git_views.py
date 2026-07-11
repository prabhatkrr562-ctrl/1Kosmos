import json
import re
import subprocess
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST


_GIT_LOCK = threading.Lock()
BRANCH_PREFIX = settings.GIT_BRANCH_PREFIX
MAIN_BRANCH = settings.GIT_MAIN_BRANCH
REMOTE_NAME = settings.GIT_REMOTE_NAME
REPOSITORY_URL = settings.GIT_REPOSITORY_URL
REPO_ROOT = Path(settings.GIT_REPOSITORY_ROOT).resolve()
GIT_DIRECTORY = Path(settings.GIT_DIRECTORY).resolve()
TRACKED_PATHS = tuple(settings.GIT_TRACKED_PATHS)
EXCLUDED_PATHS = tuple(settings.GIT_EXCLUDED_PATHS)


class GitError(RuntimeError):
    pass


def _git(*args, check=True):
    try:
        result = subprocess.run(
            ["git", f"--git-dir={GIT_DIRECTORY}", f"--work-tree={REPO_ROOT}", *args],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise GitError(f"Unable to run Git: {exc}") from exc

    if check and result.returncode:
        message = result.stderr.strip() or result.stdout.strip() or "Git command failed."
        raise GitError(message)
    return result.stdout.strip()


def _repository_git(*args, cwd=None, check=True):
    try:
        result = subprocess.run(
            ["git", f"--git-dir={GIT_DIRECTORY}", *args],
            cwd=cwd or REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise GitError(f"Unable to run Git: {exc}") from exc
    if check and result.returncode:
        raise GitError(result.stderr.strip() or result.stdout.strip() or "Git command failed.")
    return result.stdout.strip()


def _worktree_git(worktree, *args):
    try:
        result = subprocess.run(
            ["git", "-C", str(worktree), *args],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise GitError(f"Unable to run Git: {exc}") from exc
    if result.returncode:
        raise GitError(result.stderr.strip() or result.stdout.strip() or "Git command failed.")
    return result.stdout.strip()


def _repository_url():
    return _git("remote", "get-url", REMOTE_NAME, check=False)


def _configure_remote():
    current_url = _repository_url()
    if not current_url:
        _git("remote", "add", REMOTE_NAME, REPOSITORY_URL)
    elif current_url != REPOSITORY_URL:
        _git("remote", "set-url", REMOTE_NAME, REPOSITORY_URL)


def _github_url(remote):
    if remote.startswith("git@github.com:"):
        return f"https://github.com/{remote.split(':', 1)[1].removesuffix('.git')}"
    parsed = urlparse(remote)
    if parsed.hostname == "github.com":
        return f"https://github.com{parsed.path.removesuffix('.git')}"
    return remote


def _current_branch():
    branch = _git("branch", "--show-current")
    if not branch:
        raise GitError("The repository is in detached HEAD state.")
    return branch


def _version_branches():
    """Return generated branches indexed by numeric version."""
    refs = _git(
        "for-each-ref",
        "--format=%(refname:short)",
        f"refs/heads/{BRANCH_PREFIX}*",
        f"refs/remotes/{REMOTE_NAME}/{BRANCH_PREFIX}*",
    ).splitlines()
    pattern = re.compile(rf"^{re.escape(BRANCH_PREFIX)}(\d+)$")
    versions = {}
    for ref in refs:
        branch = ref.strip().removeprefix(f"{REMOTE_NAME}/")
        match = pattern.fullmatch(branch)
        if match:
            versions[int(match.group(1))] = branch
    return versions


def _latest_generated_branch():
    versions = _version_branches()
    return versions[max(versions)] if versions else ""


def _next_generated_branch():
    versions = _version_branches()
    return f"{BRANCH_PREFIX}{max(versions, default=0) + 1}"


def _merged_release_versions():
    """Return numeric release branches already contained in stable main."""
    refs = _git(
        "branch", "--merged", MAIN_BRANCH, "--format=%(refname:short)",
        "--list", f"{BRANCH_PREFIX}*", check=False,
    ).splitlines()
    pattern = re.compile(rf"^{re.escape(BRANCH_PREFIX)}(\d+)$")
    releases = []
    for ref in refs:
        branch = ref.strip()
        match = pattern.fullmatch(branch)
        if match:
            releases.append((int(match.group(1)), branch))
    return [branch for _, branch in sorted(releases, reverse=True)]


def _local_branch_exists(branch):
    return bool(_git("show-ref", "--verify", f"refs/heads/{branch}", check=False))


def _remote_branch_exists(branch):
    return bool(_git("ls-remote", "--heads", REMOTE_NAME, f"refs/heads/{branch}"))


def _stable_versions(ref=MAIN_BRANCH):
    stable = _git("rev-parse", "--verify", ref, check=False)
    previous = _git("rev-parse", "--verify", f"{ref}^1", check=False)
    return stable, previous


def _ensure_repository_ready():
    if _git("rev-parse", "--is-inside-work-tree") != "true":
        raise GitError("The configured directory is not a Git repository.")
    for operation in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"):
        if _git("rev-parse", "-q", "--verify", operation, check=False):
            raise GitError("Complete or abort the existing Git operation before using GitHub actions.")


def _working_tree_status():
    tracked = _git("diff", "HEAD", "--name-only", "--", *_source_pathspecs()).splitlines()
    untracked = _git(
        "ls-files", "--others", "--exclude-standard", "--", *_source_pathspecs()
    ).splitlines()
    return "\n".join(dict.fromkeys((*tracked, *untracked)))


def _working_tree_changes():
    """Return user-friendly status details for the configured source paths."""
    entries = []
    tracked = _git("diff", "HEAD", "--name-status", "--", *_source_pathspecs())
    labels = {
        "A": "Added", "C": "Copied", "D": "Deleted", "M": "Modified",
        "R": "Renamed", "T": "Changed",
    }
    for line in tracked.splitlines():
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        code = parts[0][:1]
        entries.append({
            "path": parts[-1].strip('"'),
            "status": labels.get(code, "Modified"),
            "code": code,
        })

    tracked_paths = {entry["path"] for entry in entries}
    untracked = _git(
        "ls-files", "--others", "--exclude-standard", "--", *_source_pathspecs()
    )
    for path in untracked.splitlines():
        clean_path = path.strip().strip('"')
        if clean_path and clean_path not in tracked_paths:
            entries.append({"path": clean_path, "status": "Added", "code": "A"})
    return entries


def _git_history():
    """Return repository activity for the Git Audit view."""
    output = _git(
        "log", "--all", "--date=iso-strict",
        "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D%x1f%P%x1e",
        check=False,
    )
    history = []
    for record in output.split("\x1e"):
        fields = record.strip().split("\x1f")
        if len(fields) != 8:
            continue
        commit_hash, short_hash, author, email, committed_at, subject, refs, parents = fields
        parent_count = len(parents.split())
        lowered_subject = subject.lower()
        if parent_count > 1 or lowered_subject.startswith("merge "):
            event = "Merge"
        elif "restore" in lowered_subject or "revert" in lowered_subject or "rollback" in lowered_subject:
            event = "Rollback"
        else:
            event = "Commit"
        history.append({
            "hash": commit_hash,
            "shortHash": short_hash,
            "author": author,
            "email": email,
            "committedAt": committed_at,
            "message": subject,
            "refs": refs,
            "event": event,
        })
    return history


def _request_json(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GitError("The Git request is invalid.") from exc


def _source_pathspecs():
    exclusions = tuple(f":(exclude,glob){path}" for path in EXCLUDED_PATHS)
    return (*TRACKED_PATHS, *exclusions)


def _changed_files(status):
    files = []
    for line in status.splitlines():
        path = line.strip()
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path:
            files.append(path.strip('"'))
    return files


@require_GET
def git_status(request):
    try:
        with _GIT_LOCK:
            _ensure_repository_ready()
            working_status = _working_tree_status()
            changed_files = _changed_files(working_status)
            changes = _working_tree_changes()
            history = _git_history()
            stable_commit, previous_commit = _stable_versions()
            merged_releases = _merged_release_versions()
            return JsonResponse({
                "repository": _github_url(REPOSITORY_URL),
                "remote": REPOSITORY_URL,
                "branch": _current_branch(),
                "mainBranch": MAIN_BRANCH,
                "latestBranch": _latest_generated_branch(),
                "nextBranch": _next_generated_branch(),
                "hasChanges": bool(changed_files),
                "changedFiles": changed_files,
                "changes": changes,
                "history": history,
                "stableVersion": merged_releases[0] if merged_releases else "",
                "previousVersion": merged_releases[1] if len(merged_releases) > 1 else "",
                "stableCommit": stable_commit[:12],
                "previousCommit": previous_commit[:12],
                "canRestorePrevious": bool(previous_commit),
                "refreshIntervalMs": settings.GIT_STATUS_REFRESH_INTERVAL_MS,
            })
    except GitError as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@require_POST
def git_push(request):
    if not _GIT_LOCK.acquire(timeout=10):
        return JsonResponse({"error": "Another Git operation is taking too long. Please try again."}, status=409)

    try:
        _ensure_repository_ready()
        _configure_remote()
        changed_files = _changed_files(_working_tree_status())
        if not changed_files:
            raise GitError("There are no local changes to push.")

        payload = _request_json(request)
        commit_message = str(payload.get("commitMessage", "")).strip()
        if not commit_message:
            raise GitError("Enter a commit message before pushing changes.")
        if len(commit_message) > 200:
            raise GitError("The commit message must be 200 characters or fewer.")

        created_branch = _next_generated_branch()
        _git("switch", "-c", created_branch)
        # Stage only real source changes. Passing the top-level frontend path
        # makes Git reject ignored runtime folders such as build/node_modules.
        _git("add", "--all", "--", *changed_files)
        _git("commit", "--no-verify", "-m", commit_message)
        _git("push", "--set-upstream", REMOTE_NAME, created_branch)

        return JsonResponse({
            "message": f"Created and pushed {created_branch}.",
            "branch": created_branch,
            "commitMessage": commit_message,
            "repository": _github_url(REPOSITORY_URL),
        })
    except GitError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    finally:
        _GIT_LOCK.release()


@csrf_exempt
@require_POST
def git_pull(request):
    if not _GIT_LOCK.acquire(timeout=10):
        return JsonResponse({"error": "Another Git operation is taking too long. Please try again."}, status=409)

    try:
        _ensure_repository_ready()
        _configure_remote()
        if _working_tree_status():
            raise GitError("The working tree must be clean before merging into main.")

        latest_branch = _latest_generated_branch()
        if not latest_branch:
            raise GitError("No generated branch is available to merge.")

        remote_main_exists = _remote_branch_exists(MAIN_BRANCH)
        if remote_main_exists:
            _git("fetch", REMOTE_NAME, MAIN_BRANCH)
            merge_base = f"{REMOTE_NAME}/{MAIN_BRANCH}"
        else:
            merge_base = latest_branch

        # Merge away from the running application. A failed merge therefore
        # cannot erase or partially replace live frontend/backend files.
        merge_dir = Path(tempfile.mkdtemp(prefix="kosmos-merge-"))
        merge_dir.rmdir()  # git worktree requires a path that does not exist.
        try:
            _repository_git("worktree", "add", "--detach", str(merge_dir), merge_base)
            if merge_base != latest_branch:
                _worktree_git(
                    merge_dir,
                    "merge", "--no-ff", latest_branch,
                    "-m", f"Merge {latest_branch} into {MAIN_BRANCH}",
                )
            merged_commit = _worktree_git(merge_dir, "rev-parse", "HEAD")
            _worktree_git(merge_dir, "push", REMOTE_NAME, f"HEAD:{MAIN_BRANCH}")
        finally:
            _repository_git("worktree", "remove", "--force", str(merge_dir), check=False)

        # Only after GitHub accepted the merge do we move local main and update
        # the live source tree to the exact successful commit.
        _repository_git("update-ref", f"refs/heads/{MAIN_BRANCH}", merged_commit)
        _repository_git("symbolic-ref", "HEAD", f"refs/heads/{MAIN_BRANCH}")
        _git("restore", "--source", merged_commit, "--staged", "--worktree", "--", *TRACKED_PATHS)
        _git("reset", "--mixed", merged_commit)
        return JsonResponse({
            "message": f"Merged {latest_branch} into {MAIN_BRANCH} and pushed successfully.",
            "branch": latest_branch,
            "mainBranch": MAIN_BRANCH,
        })
    except (GitError, subprocess.TimeoutExpired) as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    finally:
        _GIT_LOCK.release()


@csrf_exempt
@require_POST
def git_restore_previous(request):
    """Restore the previous stable main version in the local worktree only."""
    if not _GIT_LOCK.acquire(timeout=10):
        return JsonResponse({"error": "Another Git operation is taking too long. Please try again."}, status=409)
    try:
        _ensure_repository_ready()
        if _working_tree_status():
            raise GitError("Push or clear local changes before restoring a previous version.")
        stable_version, previous_version = _stable_versions()
        if not stable_version or not previous_version:
            raise GitError("No previous stable version is available.")
        _git("restore", "--source", previous_version, "--worktree", "--", *TRACKED_PATHS)
        return JsonResponse({
            "message": f"Restored previous version {previous_version[:12]} locally. GitHub was not changed.",
            "version": previous_version[:12],
        })
    except GitError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    finally:
        _GIT_LOCK.release()


@csrf_exempt
@require_POST
def git_revert_previous(request):
    """Publish the previous stable main tree as a new commit on GitHub."""
    if not _GIT_LOCK.acquire(timeout=10):
        return JsonResponse({"error": "Another Git operation is taking too long. Please try again."}, status=409)
    try:
        _ensure_repository_ready()
        _configure_remote()
        if _working_tree_status():
            raise GitError("Push or clear local changes before reverting GitHub.")
        if not _remote_branch_exists(MAIN_BRANCH):
            raise GitError(f"Remote branch {MAIN_BRANCH} does not exist.")
        _git("fetch", REMOTE_NAME, MAIN_BRANCH)
        remote_main = f"{REMOTE_NAME}/{MAIN_BRANCH}"
        stable_version, previous_version = _stable_versions(remote_main)
        if not stable_version or not previous_version:
            raise GitError("No previous stable version is available on GitHub.")

        revert_dir = Path(tempfile.mkdtemp(prefix="kosmos-revert-"))
        revert_dir.rmdir()
        try:
            _repository_git("worktree", "add", "--detach", str(revert_dir), stable_version)
            _worktree_git(revert_dir, "restore", "--source", previous_version,
                          "--staged", "--worktree", "--", *TRACKED_PATHS)
            _worktree_git(revert_dir, "commit", "--no-verify", "-m",
                          f"Restore previous stable version {previous_version[:12]}")
            reverted_commit = _worktree_git(revert_dir, "rev-parse", "HEAD")
            _worktree_git(revert_dir, "push", REMOTE_NAME, f"HEAD:{MAIN_BRANCH}")
        finally:
            _repository_git("worktree", "remove", "--force", str(revert_dir), check=False)

        _repository_git("update-ref", f"refs/heads/{MAIN_BRANCH}", reverted_commit)
        _repository_git("symbolic-ref", "HEAD", f"refs/heads/{MAIN_BRANCH}")
        _git("restore", "--source", reverted_commit, "--staged", "--worktree", "--", *TRACKED_PATHS)
        _git("reset", "--mixed", reverted_commit)
        return JsonResponse({
            "message": f"GitHub {MAIN_BRANCH} now uses previous version {previous_version[:12]}.",
            "version": previous_version[:12],
        })
    except GitError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    finally:
        _GIT_LOCK.release()
