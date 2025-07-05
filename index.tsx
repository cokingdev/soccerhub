// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
// Import GoogleAuthProvider and signInWithPopup for Google Sign-In
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
// Import getDoc, setDoc for Firestore
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, deleteDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, orderBy, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";

// Gemini API Import
import { GoogleGenAI } from "https://esm.run/@google/genai";

// Declare environment-injected variables to satisfy TypeScript
declare let PaystackPop: any;

// Global Firebase Vars - Initialize immediately (moved inside DOMContentLoaded for strict ordering)
let app;
let auth;
let db;
let ai; // Gemini AI instance

let userId = null; // Default until authenticated
let userName = 'Anonymous'; // Default user name
let userProfile = null; // Store current user's profile data
let isPremium = false; // Default premium status
let isAnonymous = true;

// Paystack Public Key (Replace with your actual public key from your Paystack Dashboard)
// For testing, you can use a test public key. DO NOT use your secret key here.
const PAYSTACK_PUBLIC_KEY = 'pk_live_1a0a4a130d8fe37d59bea52ff5d7dcc83ca2691a';


// Declare main elements at a higher scope to ensure accessibility
let predictionsSection;
let liveScoresSection;
let communitySection; // NEW: Community section
let moreAppsSection;
let myProfileSection; // RENAMED from premiumAccessSection

let sidebarToggle;
let closeSidebarBtn;
let sidebar;
let sidebarOverlay;
let darkModeToggle;

let sidebarNavPredictions;
let sidebarNavLiveScores;
let sidebarNavCommunity; // NEW: Community nav item
let sidebarNavMoreApps;
let sidebarNavMyProfile; // RENAMED from sidebarNavPremium

let aiTipsPanelWrapper;
let aiTipsContent;
let premiumAiTipsOverlay;
let overlayGoPremiumBtn;

let aiTipsContainer;

let goPremiumButton;

let liveScoresList;

let communityMainContent; // NEW
let communityChatWindow; // NEW
let communityChatInput; // NEW
let sendCommunityChatBtn; // NEW
let communityUserListSidebar; // NEW
let activeUserCountDisplay; // NEW
let userListElement; // NEW

let premiumStatusDisplay;
let userEmailDisplay;
let premiumActions;
let premiumMessage;

let getRealWorldFixturesBtn;
let realWorldFixturesList; // NEW: Declared for real-world fixtures
let realWorldFixturesSources; // NEW: To display grounding sources
let loadingAnimationContainer; // NEW: For the loading animation
let realWorldFixtures = []; // To store parsed real-world fixtures temporarily

let realWorldFixturesSectionWrapper;

// New notification elements
let dailyNotificationModal;
let notificationGotItBtn;
let toastContainer;

// Map to store generated AI tips for persistence within the session
const persistedAITips = new Map();

// Map to store live match states for simulation (for followed matches)
const liveMatchStates = new Map(); // Stores { fixtureId: { homeScore, awayScore, minute, status, ...fixtureDetails } }
const followedLiveMatchIds = new Set(); // Keep track of IDs of matches currently being followed

// NEW: User Profile Modal elements
let userProfileModal;
let closeProfileModalBtn;
let profileAvatar;
let profileUserName;
let profileUserId;
let profileFollowingCount;
let profileFollowersCount;
let followUnfollowBtn;
let privateChatBtn;

// NEW: Private Chat Modal elements
let privateChatModal;
let closePrivateChatModalBtn;
let privateChatHeader;
let privateChatMessages;
let privateChatInput;
let sendPrivateChatBtn;
let currentPrivateChatTargetId = null;
let unsubscribePrivateChat = null; // To store the unsubscribe function for private chat listener

// NEW: My Profile Section elements
let myProfileAvatar;
let myProfileUserName;
let myProfileUserId;
let myProfileFollowingCount;
let myProfileFollowersCount;


document.addEventListener('DOMContentLoaded', async () => {
    let firebaseConfig;
    try {
        // Fetch the config from the special URL provided by Firebase Hosting.
        // This ensures the app always uses the correct config for the project it's deployed to.
        const response = await fetch('/__/firebase/init.json');
        if (!response.ok) {
            // This will fail in local development unless you use the Firebase Emulator Suite.
            // For production, this is the most reliable method.
            throw new Error(`Firebase config not found. Status: ${response.status}`);
        }
        firebaseConfig = await response.json();
    } catch (error) {
        console.error("CRITICAL: Could not load Firebase configuration.", error);
        document.body.innerHTML = `
            <div class="p-8 text-center text-red-600 bg-red-100 h-screen flex flex-col justify-center items-center">
                <h1 class="text-2xl font-bold">Error: Application Failed to Start</h1>
                <p class="mt-2">Could not load Firebase configuration. This app must be run on a Firebase Hosting environment.</p>
                <p class="mt-1 text-sm text-gray-700">If you are developing locally, please use the Firebase Emulator Suite.</p>
            </div>
        `;
        return; // Stop all further execution
    }

    // Initialize Firebase and Gemini AI here, after DOM is ready
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Your app's unique identifier for Firestore paths
    const APP_IDENTIFIER = firebaseConfig.projectId;

    // Enable Firestore offline persistence to make the app more robust against network issues
    try {
        await enableIndexedDbPersistence(db);
        console.log("Firestore offline persistence enabled.");
    } catch (err) {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled
            // in one tab at a a time.
            console.warn("Firestore persistence failed: failed-precondition. More than one tab open?");
        } else if (err.code == 'unimplemented') {
            // The current browser does not support all of the
            // features required to enable persistence
            console.warn("Firestore persistence failed: unimplemented. Browser not supported?");
        }
    }
    
    // Securely initialize Gemini AI.
    // The hosting environment is expected to provide the API key via the `process.env.API_KEY` variable.
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        console.error("Failed to initialize Gemini AI. This can happen if the API_KEY is not configured in the environment.", e);
        ai = null; // Ensure ai is null to prevent further errors.
    }
    
    const analytics = getAnalytics(app); // Initialize analytics if needed

    console.log(`DOMContentLoaded: Firebase Initialized for project ${firebaseConfig.projectId}.`);
    
    // Helper function to escape single quotes for onclick attributes
    const escapeAttr = (str) => String(str).replace(/'/g, "\\'");
    
    // Helper function to escape HTML to prevent XSS
    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>"']/g, (match) => {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;';
                default: return match;
            }
        });
    };

    predictionsSection = document.getElementById('predictions-section');
    liveScoresSection = document.getElementById('live-scores-section'); // New section
    communitySection = document.getElementById('community-section'); // NEW
    moreAppsSection = document.getElementById('more-apps-section');
    myProfileSection = document.getElementById('my-profile-section'); // RENAMED

    sidebarToggle = document.getElementById('sidebar-toggle');
    closeSidebarBtn = document.getElementById('close-sidebar');
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebar-overlay');
    darkModeToggle = document.getElementById('dark-mode-toggle');

    sidebarNavPredictions = document.getElementById('sidebar-nav-predictions');
    sidebarNavLiveScores = document.getElementById('sidebar-nav-live-scores'); // New nav item
    sidebarNavCommunity = document.getElementById('sidebar-nav-community'); // NEW
    sidebarNavMoreApps = document.getElementById('sidebar-nav-more-apps');
    sidebarNavMyProfile = document.getElementById('sidebar-nav-my-profile'); // RENAMED

    aiTipsPanelWrapper = document.getElementById('ai-tips-panel-wrapper');
    aiTipsContent = document.getElementById('ai-tips-content');
    premiumAiTipsOverlay = document.getElementById('premium-ai-tips-overlay');
    overlayGoPremiumBtn = document.getElementById('overlay-go-premium-btn');

    aiTipsContainer = document.getElementById('ai-tips-container');

    goPremiumButton = document.getElementById('go-premium-button');

    liveScoresList = document.getElementById('live-scores-list');

    communityMainContent = document.getElementById('community-main-content'); // NEW
    communityChatWindow = document.getElementById('community-chat-window'); // NEW
    communityChatInput = document.getElementById('community-chat-input'); // NEW
    sendCommunityChatBtn = document.getElementById('send-community-chat-btn'); // NEW
    communityUserListSidebar = document.getElementById('community-user-list-sidebar'); // NEW
    activeUserCountDisplay = document.getElementById('active-user-count'); // NEW
    userListElement = document.getElementById('user-list'); // NEW

    const sections = [predictionsSection, liveScoresSection, communitySection, moreAppsSection, myProfileSection];
    const sidebarNavItems = [sidebarNavPredictions, sidebarNavLiveScores, sidebarNavCommunity, sidebarNavMoreApps, sidebarNavMyProfile];

    premiumStatusDisplay = document.getElementById('premium-status-display');
    userEmailDisplay = document.getElementById('user-email-display');
    premiumActions = document.getElementById('premium-actions');
    premiumMessage = document.getElementById('premium-message');

    getRealWorldFixturesBtn = document.getElementById('get-real-world-fixtures-btn');
    realWorldFixturesList = document.getElementById('real-world-fixtures-list');
    realWorldFixturesSources = document.getElementById('real-world-fixtures-sources');
    realWorldFixturesSectionWrapper = document.getElementById('real-world-fixtures-section-wrapper');
    loadingAnimationContainer = document.getElementById('loading-animation-container');

    dailyNotificationModal = document.getElementById('daily-notification-modal');
    notificationGotItBtn = document.getElementById('notification-got-it-btn');
    toastContainer = document.getElementById('toast-container');

    userProfileModal = document.getElementById('user-profile-modal');
    closeProfileModalBtn = document.getElementById('close-profile-modal');
    profileAvatar = document.getElementById('profile-avatar');
    profileUserName = document.getElementById('profile-user-name');
    profileUserId = document.getElementById('profile-user-id');
    profileFollowingCount = document.getElementById('profile-following-count');
    profileFollowersCount = document.getElementById('profile-followers-count');
    followUnfollowBtn = document.getElementById('follow-unfollow-btn');
    privateChatBtn = document.getElementById('private-chat-btn');

    privateChatModal = document.getElementById('private-chat-modal');
    closePrivateChatModalBtn = document.getElementById('close-private-chat-modal');
    privateChatHeader = document.getElementById('private-chat-header');
    privateChatMessages = document.getElementById('private-chat-messages');
    privateChatInput = document.getElementById('private-chat-input');
    sendPrivateChatBtn = document.getElementById('send-private-chat-btn');

    myProfileAvatar = document.getElementById('my-profile-avatar');
    myProfileUserName = document.getElementById('my-profile-user-name');
    myProfileUserId = document.getElementById('my-profile-user-id');
    myProfileFollowingCount = document.getElementById('my-profile-following-count');
    myProfileFollowersCount = document.getElementById('my-profile-followers-count');

    // Gracefully handle missing AI instance
    if (!ai) {
        if(getRealWorldFixturesBtn) {
            getRealWorldFixturesBtn.disabled = true;
            getRealWorldFixturesBtn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> AI Not Configured';
            getRealWorldFixturesBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            getRealWorldFixturesBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
    }
    
    const showNotification = (message, type = 'success') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100); // Animate in
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 4000); // Animate out and remove
    };
    
    const handlePremiumPurchase = () => {
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            showNotification('Please sign in with Google to purchase premium!', 'warning');
            return;
        }

        if (isPremium) {
            showNotification('You are already a premium member!', 'success');
            return;
        }

        const handler = PaystackPop.setup({
            key: PAYSTACK_PUBLIC_KEY,
            email: auth.currentUser.email,
            amount: 500, // 500 cents = $5.00 USD
            currency: 'USD',
            ref: '' + Math.floor((Math.random() * 1000000000) + 1), // Unique ref
            onClose: function() {
                showNotification('Payment window closed.', 'warning');
            },
            callback: async function(response) {
                // response.reference
                console.log('Payment successful. Reference:', response.reference);
                try {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    await updateDoc(userRef, {
                        isPremium: true,
                        premiumSince: serverTimestamp(),
                        lastTransactionRef: response.reference
                    });
                    showNotification('Congratulations! You are now a premium member.', 'success');
                    // The onSnapshot listener will handle the UI update automatically
                } catch (error) {
                    console.error("Error updating user to premium:", error);
                    showNotification('Payment was successful, but there was an error updating your account. Please contact support.', 'error');
                }
            }
        });
        handler.openIframe();
    };

    const updateMyProfileUI = () => {
        if (!isAnonymous && userProfile) {
            myProfileAvatar.textContent = (userName?.charAt(0) || 'A').toUpperCase();
            myProfileUserName.textContent = userName;
            myProfileUserId.textContent = `ID: ${userId}`;
            myProfileFollowingCount.textContent = String(userProfile.following?.length ?? 0);
            myProfileFollowersCount.textContent = String(userProfile.followers?.length ?? 0);
        } else {
            myProfileAvatar.textContent = 'A'; // For Anonymous
            myProfileUserName.textContent = 'Anonymous User';
            myProfileUserId.textContent = 'Sign in to see your profile';
            myProfileFollowingCount.textContent = '0';
            myProfileFollowersCount.textContent = '0';
        }
    };
    
    const updatePremiumUI = () => {
        const googleSignInBtn = `<button id="google-sign-in-btn" class="w-full bg-blue-700 text-white px-5 py-3 rounded-full font-semibold shadow-md hover:bg-blue-800 transition-colors duration-200 flex items-center justify-center">
                                     <i class="fab fa-google mr-2"></i> Sign in with Google
                                 </button>`;
        const goPremiumBtnHTML = `<button id="paystack-go-premium-btn" class="w-full bg-yellow-500 text-white px-5 py-3 rounded-full font-semibold shadow-lg hover:bg-yellow-600 transition-colors duration-200">
                                         <i class="fas fa-crown mr-2"></i> Go Premium ($5)
                                     </button>`;
        const signOutBtnHTML = `<button id="sign-out-btn" class="w-full bg-red-600 text-white px-5 py-3 rounded-full font-semibold shadow-md hover:bg-red-700 transition-colors duration-200">
                                     <i class="fas fa-sign-out-alt mr-2"></i> Sign Out
                                 </button>`;
                                 
        if (isAnonymous) {
            premiumStatusDisplay.textContent = 'Sign in for full access';
            premiumStatusDisplay.className = 'text-lg mb-4 text-yellow-500 font-semibold';
            premiumActions.innerHTML = googleSignInBtn;
            userEmailDisplay.classList.add('hidden');
            premiumMessage.classList.add('hidden');
        } else {
            userEmailDisplay.textContent = auth.currentUser?.email || 'No email';
            userEmailDisplay.classList.remove('hidden');
            if (isPremium) {
                premiumStatusDisplay.textContent = 'Active';
                premiumStatusDisplay.className = 'text-lg mb-4 text-green-500 font-bold';
                premiumMessage.textContent = 'Thank you for being a premium member!';
                premiumMessage.className = 'mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
                premiumMessage.classList.remove('hidden');
                premiumActions.innerHTML = signOutBtnHTML;
            } else {
                premiumStatusDisplay.textContent = 'Inactive';
                premiumStatusDisplay.className = 'text-lg mb-4 text-red-500 font-semibold';
                premiumMessage.textContent = 'Unlock all features by going premium!';
                premiumMessage.className = 'mt-4 p-3 rounded-lg text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
                premiumMessage.classList.remove('hidden');
                premiumActions.innerHTML = goPremiumBtnHTML + '<div class="my-2"></div>' + signOutBtnHTML;
            }
        }
        
        // Wire up new buttons
        const signInBtn = document.getElementById('google-sign-in-btn');
        if(signInBtn) signInBtn.addEventListener('click', handleGoogleSignIn);

        const signOutBtn = document.getElementById('sign-out-btn');
        if(signOutBtn) signOutBtn.addEventListener('click', () => auth.signOut());

        const payBtn = document.getElementById('paystack-go-premium-btn');
        if(payBtn) payBtn.addEventListener('click', handlePremiumPurchase);


        // Toggle main "Go Premium" buttons visibility
        goPremiumButton.style.display = isPremium ? 'none' : 'block';
        premiumAiTipsOverlay.classList.toggle('hidden', isPremium);

        // Re-render fixtures if they exist to apply premium status
        if (realWorldFixtures.length > 0) {
            displayFixturesWithPredictions(realWorldFixtures, realWorldFixturesList);
        }
        updateAITipsPanel();
    };

    const handleGoogleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        // The Firebase SDK automatically uses the OAuth client ID configured
        // in your Firebase project's authentication settings.
        // Removing the hardcoded client ID makes the code cleaner and more portable.
        try {
            await signInWithPopup(auth, provider);
            showNotification('Successfully signed in with Google!', 'success');
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            showNotification('Could not sign in with Google.', 'error');
        }
    };
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in.
            const userRef = doc(db, 'users', user.uid);
            
            onSnapshot(userRef, async (docSnap) => {
                if (docSnap.exists()) {
                    // User profile exists
                    userProfile = docSnap.data();
                    isPremium = userProfile.isPremium || false;
                } else {
                    // New user, create a profile
                    userProfile = {
                        name: user.displayName || 'Anonymous User',
                        email: user.email,
                        createdAt: serverTimestamp(),
                        isPremium: false,
                        following: [],
                        followers: []
                    };
                    await setDoc(userRef, userProfile);
                    isPremium = false;
                }

                userId = user.uid;
                userName = user.isAnonymous ? 'Anonymous User' : (userProfile.name || user.displayName);
                isAnonymous = user.isAnonymous;
                
                console.log(`User state changed. UID: ${userId}, Premium: ${isPremium}, Anonymous: ${isAnonymous}`);
                updatePremiumUI();
                updateMyProfileUI();
            });

        } else {
            // User is signed out.
            console.log("No user signed in. Attempting anonymous sign-in.");
            userId = null;
            userName = 'Anonymous';
            userProfile = null;
            isPremium = false;
            isAnonymous = true;
            updatePremiumUI();
            updateMyProfileUI();
            
            try {
                await signInAnonymously(auth);
            } catch (error) {
                 console.error("Anonymous sign-in failed:", error);
                 showNotification('Could not start a session. Some features may be disabled.', 'error');
            }
        }
    });

    const getColorForUser = (uid) => {
        let hash = 0;
        for (let i = 0; i < uid.length; i++) {
            hash = uid.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            color += ('00' + value.toString(16)).substr(-2);
        }
        return color;
    };

    const formatDate = (date) => {
         return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    let dailyRefreshTimeout = null; // To store the timeout ID for daily refresh
    let liveScoresInterval = null; // To store the interval ID for live scores
    
    const showSection = (sectionToShow, navItemToActivate) => {
        sections.forEach(section => {
            section.classList.remove('active');
        });
        sidebarNavItems.forEach(item => {
            item.classList.remove('active');
        });

        sectionToShow.classList.add('active');
        navItemToActivate.classList.add('active');

        hideSidebar();
        document.getElementById('content-area').scrollTo({ top: 0, behavior: 'smooth' });

        if (sectionToShow === liveScoresSection) {
            // startLiveScoresUpdate();
        } else {
            // stopLiveScoresUpdate();
        }

        if (sectionToShow === predictionsSection && realWorldFixtures.length > 0) {
             displayFixturesWithPredictions(realWorldFixtures, realWorldFixturesList);
        }

        if (sectionToShow === communitySection) {
            // fetchAndDisplayCommunityMessages();
        }

        if (sectionToShow === myProfileSection) {
            updateMyProfileUI();
        }
    };

    const showSidebar = () => {
        sidebar.classList.add('show');
        sidebarOverlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const hideSidebar = () => {
        sidebar.classList.remove('show');
        sidebarOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    };

    sidebarToggle.addEventListener('click', showSidebar);
    closeSidebarBtn.addEventListener('click', hideSidebar);
    sidebarOverlay.addEventListener('click', hideSidebar);

    sidebarNavPredictions.addEventListener('click', () => showSection(predictionsSection, sidebarNavPredictions));
    sidebarNavLiveScores.addEventListener('click', () => showSection(liveScoresSection, sidebarNavLiveScores));
    sidebarNavCommunity.addEventListener('click', () => showSection(communitySection, sidebarNavCommunity));
    sidebarNavMoreApps.addEventListener('click', () => showSection(moreAppsSection, sidebarNavMoreApps)); // Placeholder action
    sidebarNavMyProfile.addEventListener('click', () => showSection(myProfileSection, sidebarNavMyProfile));

    darkModeToggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', darkModeToggle.checked);
        localStorage.setItem('dark-mode', darkModeToggle.checked ? 'enabled' : 'disabled');
    });

    if (localStorage.getItem('dark-mode') === 'enabled') {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }
    
    // Attach payment handler to buttons
    goPremiumButton.addEventListener('click', handlePremiumPurchase);
    overlayGoPremiumBtn.addEventListener('click', handlePremiumPurchase);
    
    async function generateFixturesAndPredictionsWithGemini(dateString) {
        if (!ai) {
            console.error("[Gemini Fixtures] AI not initialized.");
            return { fixtures: null, sources: [] };
        }
        console.log(`[Gemini Fixtures] Requesting fixtures and predictions for ${dateString} using Google Search grounding.`);
        const prompt = `
            You are a world-class sports data provider specializing in soccer fixtures and predictions.
            Your critical task is to find and list soccer matches for today, **${dateString}**, AND provide a basic prediction for each.

            **Critical Requirement:** You MUST use your search tool to find as many fixtures as possible, aiming for **at least 50 fixtures if available worldwide**. Search broadly across all major and minor leagues.

            The output MUST be a valid JSON array of objects. Each object represents one fixture and must conform to this exact schema:
            {
              "fixtureId": "INTEGER",
              "homeTeam": "STRING",
              "awayTeam": "STRING",
              "league": "STRING",
              "country": "STRING",
              "time": "STRING (HH:MM UTC)",
              "prediction": {
                  "predictionOutcome": "STRING (e.g., 'Home Win', 'Draw', 'Away Win')",
                  "confidence": "STRING ('High', 'Medium', or 'Low')",
                  "scoreline": "STRING (e.g., '2-1')",
                  "ht_ft": "STRING (e.g., 'X/1')",
                  "statementAnalysis": "STRING (A brief, one-sentence analysis of the prediction. For premium users.)"
              }
            }

            - "fixtureId" must be a unique integer you generate for each match.
            - "time" must be in "HH:MM" 24-hour format (UTC).
            - The "prediction" object MUST be included for every fixture.
        `;

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-04-17',
                contents: prompt,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });

            let jsonStr = response.text.trim();
            
            // 1. Extract from markdown fence if present
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }
            
            // 2. Find the start and end of the JSON array to strip conversational text
            const firstBracket = jsonStr.indexOf('[');
            const lastBracket = jsonStr.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket > firstBracket) {
                jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
            }

            // 3. Remove trailing commas that break JSON.parse
            jsonStr = jsonStr.replace(/,(?=\s*?[}\]])/g, '');

            const parsedData = JSON.parse(jsonStr);
            const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

            if (Array.isArray(parsedData) && parsedData.every(item => item.prediction)) {
                console.log(`[Gemini Fixtures] Successfully parsed ${parsedData.length} fixtures with predictions.`);
                return { fixtures: parsedData, sources };
            } else {
                 console.error("[Gemini Fixtures] Parsed data is not a valid array of fixtures with predictions:", parsedData);
                 return { fixtures: null, sources };
            }
        } catch (error) {
            console.error("[Gemini Fixtures] Error generating or parsing fixtures:", error);
            return { fixtures: null, sources: [] };
        }
    }

    function updateAITipsPanel() {
        if (realWorldFixtures.length === 0) {
            aiTipsContainer.innerHTML = `<div class="text-gray-200 opacity-80">Premium tips will appear here once fixtures are loaded.</div>`;
            return;
        }

        let tipsHtml = '';
        realWorldFixtures.forEach(fixture => {
            const tip = fixture.prediction;
            if (fixture && tip && tip.statementAnalysis) {
                 tipsHtml += `
                    <div class="bg-black bg-opacity-20 p-3 rounded-lg">
                        <p class="font-bold">${escapeHTML(fixture.homeTeam)} vs ${escapeHTML(fixture.awayTeam)}</p>
                        <p class="text-sm">${isPremium ? escapeHTML(tip.statementAnalysis) : 'Unlock Premium to see detailed analysis.'}</p>
                    </div>
                 `;
            }
        });
        aiTipsContainer.innerHTML = tipsHtml || `<div class="text-gray-200 opacity-80">No valid premium tips available.</div>`;
    }

    function displayFixturesWithPredictions(fixtures, container) {
        if (!fixtures || fixtures.length === 0) {
            container.innerHTML = `<div class="text-center text-gray-600 dark:text-gray-300">No fixtures to display.</div>`;
            return;
        }

        container.innerHTML = fixtures.map(fixture => {
            const fixtureId = fixture.fixtureId;
            const prediction = fixture.prediction;

            if (!prediction) {
                console.warn(`Fixture ${fixtureId} is missing prediction data.`);
                return ''; // Skip rendering this fixture if prediction is missing
            }

            const confidenceColor = prediction.confidence === 'High' ? 'text-green-500' : prediction.confidence === 'Medium' ? 'text-yellow-500' : 'text-gray-500';

            const predictionHTML = `
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div class="font-semibold text-gray-500 dark:text-gray-400">Outcome</div>
                        <div>${escapeHTML(prediction.predictionOutcome)}</div>
                    </div>
                    <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div class="font-semibold text-gray-500 dark:text-gray-400">Confidence</div>
                        <div class="${confidenceColor}">${escapeHTML(prediction.confidence)}</div>
                    </div>
                    <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div class="font-semibold text-gray-500 dark:text-gray-400">Score (Premium)</div>
                        <div class="flex items-center justify-center">${isPremium ? escapeHTML(prediction.scoreline) : '<i class="fas fa-lock text-yellow-500"></i>'}</div>
                    </div>
                    <div class="p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div class="font-semibold text-gray-500 dark:text-gray-400">HT/FT (Premium)</div>
                        <div class="flex items-center justify-center">${isPremium ? escapeHTML(prediction.ht_ft) : '<i class="fas fa-lock text-yellow-500"></i>'}</div>
                    </div>
                </div>
            `;

            return `
                <div id="fixture-${fixtureId}" class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner space-y-3">
                    <div class="flex justify-between items-center">
                        <div class="font-bold text-sm text-blue-600 dark:text-blue-400">${escapeHTML(fixture.league)} - ${escapeHTML(fixture.country)}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400">${fixture.time} UTC</div>
                    </div>
                    <div class="flex items-center justify-around text-center">
                        <div class="flex-1">
                            <div class="font-bold text-lg">${escapeHTML(fixture.homeTeam)}</div>
                        </div>
                        <div class="font-extrabold text-2xl text-gray-400 dark:text-gray-500">VS</div>
                        <div class="flex-1">
                            <div class="font-bold text-lg">${escapeHTML(fixture.awayTeam)}</div>
                        </div>
                    </div>
                    <div id="prediction-${fixtureId}" class="pt-2 border-t border-gray-200 dark:border-gray-600">
                        ${predictionHTML}
                    </div>
                </div>
            `;
        }).join('');
        
        updateAITipsPanel();
    }


    function displayFixtureSources(sources) {
        if (!sources || sources.length === 0) {
            realWorldFixturesSources.innerHTML = '';
            return;
        }

        const uniqueSources = sources.reduce((acc, current) => {
            if (current.web && current.web.uri && !acc.find(item => item.web.uri === current.web.uri)) {
                acc.push(current);
            }
            return acc;
        }, []);

        if (uniqueSources.length === 0) {
            realWorldFixturesSources.innerHTML = '';
            return;
        }

        realWorldFixturesSources.innerHTML = `
            <h4 class="font-semibold text-sm mb-2 mt-4 border-t border-gray-200 dark:border-gray-700 pt-2">Data Sources:</h4>
            <ul class="list-disc list-inside space-y-1">
                ${uniqueSources.map(source => `
                    <li>
                        <a href="${source.web.uri}" target="_blank" rel="noopener noreferrer" class="hover:underline text-blue-500">
                            ${escapeHTML(source.web.title) || source.web.uri}
                        </a>
                    </li>
                `).join('')}
            </ul>
        `;
    }

    const getMsUntilNextMidnight = () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setDate(now.getDate() + 1);
        midnight.setHours(0, 0, 0, 0);
        return midnight.getTime() - now.getTime();
    };

    const scheduleDailyRefresh = () => {
        if (dailyRefreshTimeout) {
            clearTimeout(dailyRefreshTimeout);
        }
        const msUntilMidnight = getMsUntilNextMidnight();
        console.log(`[Scheduling] Next daily refresh in ${msUntilMidnight / (1000 * 60 * 60)} hours.`);
        dailyRefreshTimeout = setTimeout(() => {
            console.log('[Scheduling] Daily refresh triggered. Clearing fixtures.');
            persistedAITips.clear();
            realWorldFixtures = [];
            realWorldFixturesList.innerHTML = `
                <div class="text-center text-gray-600 dark:text-gray-300">
                    Yesterday's fixtures cleared. Click "Get Today's Fixtures" to load the new matches!
                </div>
            `;
            realWorldFixturesSources.innerHTML = ''; // Also clear sources
            updateAITipsPanel();
            scheduleDailyRefresh();
        }, msUntilMidnight);
    };

    getRealWorldFixturesBtn.addEventListener('click', async () => {
        console.log("[Get Real-World Fixtures Button] Clicked.");

        if (!ai) {
            showNotification('AI features are not available. The API key might be missing.', 'error');
            return;
        }

        realWorldFixturesList.classList.add('hidden');
        loadingAnimationContainer.classList.remove('hidden');
        realWorldFixturesSources.innerHTML = ''; // Clear previous sources
        getRealWorldFixturesBtn.disabled = true;

        try {
            const today = new Date();
            const dateString = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

            const { fixtures, sources } = await generateFixturesAndPredictionsWithGemini(dateString);

            if (!fixtures || fixtures.length === 0) {
                realWorldFixturesList.innerHTML = `<div class="text-center text-gray-600 dark:text-gray-300">Could not fetch fixtures. The AI may be busy or there are no major games today. Please try again later.</div>`;
                showNotification('No fixtures were returned by the AI.', 'warning');
                return;
            }

            realWorldFixtures = fixtures;
            
            // This replaces the old persistedAITips logic with the new consolidated data
            persistedAITips.clear();
            fixtures.forEach(fixture => {
                if (fixture.prediction) {
                    persistedAITips.set(fixture.fixtureId, fixture.prediction);
                }
            });
            
            displayFixturesWithPredictions(fixtures, realWorldFixturesList);
            displayFixtureSources(sources);
            showNotification(`Loaded ${fixtures.length} fixtures for today!`, 'success');

        } catch (error) {
            console.error("Error fetching real-world fixtures:", error);
            realWorldFixturesList.innerHTML = `<div class="text-center text-red-500">An error occurred while fetching fixtures. Please check the console and try again.</div>`;
            showNotification('An error occurred while fetching fixtures.', 'error');
        } finally {
            getRealWorldFixturesBtn.disabled = false;
            loadingAnimationContainer.classList.add('hidden');
            realWorldFixturesList.classList.remove('hidden');
        }
    });

    scheduleDailyRefresh();
});