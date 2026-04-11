package safetrack.app;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.MessageDigest;

@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {

  @PluginMethod
  public void checkSignature(PluginCall call) {
    try {
      PackageInfo packageInfo;

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        packageInfo = getContext().getPackageManager().getPackageInfo(
          getContext().getPackageName(),
          PackageManager.GET_SIGNING_CERTIFICATES
        );
      } else {
        packageInfo = getContext().getPackageManager().getPackageInfo(
          getContext().getPackageName(),
          PackageManager.GET_SIGNATURES
        );
      }

      Signature[] signatures;

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        signatures = packageInfo.signingInfo.getApkContentsSigners();
      } else {
        signatures = packageInfo.signatures;
      }

      byte[] cert = signatures[0].toByteArray();

      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(cert);

      StringBuilder hexString = new StringBuilder();
      for (byte b : digest) {
        hexString.append(String.format("%02X:", b));
      }

      String sha256 = hexString.toString();

      String expected = "YOUR_SHA256_HERE";

      boolean result = sha256.equals(expected);

      JSObject ret = new JSObject();
      ret.put("valid", result);

      call.resolve(ret);

    } catch (Exception e) {
      call.reject("Error: " + e.getMessage());
    }
  }
}
