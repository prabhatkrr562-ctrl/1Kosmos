import subprocess
import tempfile
import threading
from datetime import datetime, timezone
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


def _latest_generated_branch():
    branches = _git(
        "for-each-ref",
        "--sort=-committerdate",
        "--format=%(refname:short)",
        f"refs/heads/{BRANCH_PREFIX}*",
    ).splitlines()
    return branches[0].strip() if branches else ""


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
            stable_version, previous_version = _stable_versions()
            return JsonResponse({
                "repository": _github_url(REPOSITORY_URL),
                "remote": REPOSITORY_URL,
                "branch": _current_branch(),
                "mainBranch": MAIN_BRANCH,
                "latestBranch": _latest_generated_branch(),
                "hasChanges": bool(changed_files),
                "changedFiles": changed_files,
                "stableVersion": stable_version[:12],
                "previousVersion": previous_version[:12],
                "canRestorePrevious": bool(previous_version),
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

        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        created_branch = f"{BRANCH_PREFIX}{stamp}"
        current_branch = _current_branch()
        if current_branch.startswith(BRANCH_PREFIX) and not _git(
            "log", "-1", "--format=%s"
        ).startswith("Kosmos frontend push"):
            # Reuse a branch left by a previous failed attempt rather than
            # creating a trail of empty branches.
            created_branch = current_branch
        else:
            _git("switch", "-c", created_branch)
        # Stage only real source changes. Passing the top-level frontend path
        # makes Git reject ignored runtime folders such as build/node_modules.
        _git("add", "--all", "--", *changed_files)
        _git("commit", "--no-verify", "-m", f"Kosmos frontend push {stamp} UTC")
        _git("push", "--set-upstream", REMOTE_NAME, created_branch)

        return JsonResponse({
            "message": f"Created and pushed {created_branch}.",
            "branch": created_branch,
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
