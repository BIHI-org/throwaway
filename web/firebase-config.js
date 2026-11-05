/* Paste your Firebase web config here to sync orders across every device.
   Leave it as null and the POS still works, but each device keeps its own data.
   Firebase console → Project settings → Your apps → Web app → "Config". */
window.MRCHEF_FIREBASE = null;
/* Example:
window.MRCHEF_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  appId: "1:123:web:abc"
};
*/
/* One Firebase project can hold several restaurants; each gets its own data. */
window.MRCHEF_SHOP = "mrchef";
