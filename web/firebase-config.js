/* Firebase web config for the shared orders database (project mrchef-b8507).
   These keys are meant to be public; the Firestore rules and anonymous sign-in protect the data.
   Set to null to run each device on its own. */
window.MRCHEF_FIREBASE = {
  apiKey: "AIzaSyDlmI4QciY20gcjIZ6mt_lJ2tiISGPRMi8",
  authDomain: "mrchef-b8507.firebaseapp.com",
  projectId: "mrchef-b8507",
  storageBucket: "mrchef-b8507.firebasestorage.app",
  messagingSenderId: "984219635381",
  appId: "1:984219635381:web:e13e1a22a79071b73238fc"
};
/* One Firebase project can hold several restaurants; each gets its own data. */
window.MRCHEF_SHOP = "mrchef";
