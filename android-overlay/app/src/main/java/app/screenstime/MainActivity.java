package app.screenstime;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** The one screen of the app: Capacitor's WebView showing the web app in /www, plus our plugin. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreensTimePlugin.class);   // must come before super.onCreate
        super.onCreate(savedInstanceState);
    }
}
