package safetrack.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.Manifest;
import android.os.Build;
import androidx.core.app.ActivityCompat;


public class MainActivity extends BridgeActivity {

	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		// Make the Activity window transparent so camera preview (toBack=true) is visible behind WebView
		getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
	}

		@Override
		public void onStart() {
		super.onStart();
		// Ensure the Capacitor WebView itself is transparent
		if (getBridge() != null && getBridge().getWebView() != null) {
			getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
		}
	}
}
