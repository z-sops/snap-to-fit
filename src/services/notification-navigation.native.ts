import * as Notifications from "expo-notifications";
import "./routine-notifications";
export function notificationNavigation(
  open: (path: "/metabolic" | "/education") => void,
) {
  let active = true;
  function handle(response: Notifications.NotificationResponse) {
    if (!active) return;
    const path = response.notification.request.content.data?.screen;
    if (path === "/metabolic" || path === "/education") {
      open(path);
      void Notifications.clearLastNotificationResponseAsync();
    }
  }
  const listener =
    Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (r) handle(r);
    })
    .catch(() => {});
  return () => {
    active = false;
    listener.remove();
  };
}
