<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyARK90mp2xbhKBsU7tcfVGdh9U5lmeKcmE",
    authDomain: "aihairsalon.firebaseapp.com",
    databaseURL: "https://aihairsalon-default-rtdb.firebaseio.com",
    projectId: "aihairsalon",
    storageBucket: "aihairsalon.firebasestorage.app",
    messagingSenderId: "745084117511",
    appId: "1:745084117511:web:e4791d873fae79eae740a2",
    measurementId: "G-5K4T9NE0MC"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>