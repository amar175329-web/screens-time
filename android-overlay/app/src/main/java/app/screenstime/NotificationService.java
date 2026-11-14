package app.screenstime;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Counts new notifications per app, and silences the apps the person muted. Message text is never read or stored. */
public class NotificationService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null) return;
            String pkg = sbn.getPackageName();
            if (pkg == null || pkg.equals(getPackageName())) return;
            Notification n = sbn.getNotification();
            boolean summary = n != null && (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0;
            if (summary || sbn.isOngoing()) return;          // not a new message
            Store.get(this).addNotif(System.currentTimeMillis(), pkg);
            if (Config.muted(this, pkg)) cancelNotification(sbn.getKey());
        } catch (Exception ignored) { /* never crash the listener */ }
    }
}
