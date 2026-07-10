export const PERMISSION_DENIED_MESSAGE =
  "You don't have sufficient permission to access this. If you are facing any issues, please contact your administrator.";

export async function readApiJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (response.status === 403) {
    throw new Error(PERMISSION_DENIED_MESSAGE);
  }
  if (!response.ok) {
    throw new Error(data.error || fallbackMessage);
  }
  return data;
}
