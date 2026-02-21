import "./global.css";
import "./src/i18n";
import React, { useEffect } from 'react';
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EntryScreen from './src/screens/EntryScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import NameInputScreen from './src/screens/NameInputScreen';
import RouletteScreen from './src/screens/RouletteScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import OfflineInputScreen from './src/screens/OfflineInputScreen';
import { Colors } from './src/theme/colors';
import { feedbackService } from './src/services/FeedbackService';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    // Load audio assets on app start
    console.log('🎵 App: Starting to load audio assets...');
    feedbackService.loadAssets()
      .then(() => console.log('🎵 App: Audio assets loaded successfully!'))
      .catch(err => console.error('🎵 App: Failed to load audio assets:', err));
  }, []);

  const linking = {
    prefixes: ['http://localhost:19006', 'https://roulette-app.vercel.app', 'rouletteapp://'],
    config: {
      screens: {
        Entry: '', // Root path should be Entry
        Welcome: 'welcome',
        NameInput: 'name-input',
        Roulette: 'roulette',
        Result: 'result',
        History: 'history',
        OfflineInput: 'offline-input',
      },
    },
    // Extract roomId from query parameters
    getStateFromPath: (path, config) => {
      const state = getStateFromPath(path, config);

      // Extract roomId from query parameters or path
      let roomId = null;
      try {
        if (path.includes('roomId=')) {
          const match = path.match(/roomId=([^&]+)/);
          if (match) roomId = match[1];
        }
      } catch (e) {
        console.error('App: Failed to parse roomId from path', e);
      }

      if (roomId && state && state.routes) {
        // If we land on Entry Screen with a roomId, redirect them to Welcome
        const hasWelcome = state.routes.some(r => r.name === 'Welcome');
        if (!hasWelcome) {
          state.routes.push({
            name: 'Welcome',
            params: { mode: 'online', roomId }
          });
        } else {
          // If Welcome is already there, just inject the roomId
          const welcomeRoute = state.routes.find(r => r.name === 'Welcome');
          welcomeRoute.params = { ...welcomeRoute.params, roomId };
        }
      }

      return state;
    }
  };

  // Helper function to inject roomId into state
  const injectRoomId = (state, roomId) => {
    if (!state || !state.routes) return;

    // Check if Welcome is in the current state routes
    const welcomeRoute = state.routes.find(r => r.name === 'Welcome');
    if (welcomeRoute) {
      welcomeRoute.params = { ...welcomeRoute.params, roomId };
    } else {
      // If we found a roomId but we are at the root or elsewhere, 
      // we might want to ensure Welcome is accessible with this ID.
      // For now, just focus on when Welcome is active.
    }
  };

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator
        initialRouteName="Entry"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="Entry" component={EntryScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="NameInput" component={NameInputScreen} />
        <Stack.Screen name="Roulette" component={RouletteScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="OfflineInput" component={OfflineInputScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
