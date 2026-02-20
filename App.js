import "./global.css";
import "./src/i18n";
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
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
        Welcome: '', // Root path
      },
    },
    // Extract roomId from query parameters
    getStateFromPath: (path, options) => {
      const state = options?.getStateFromPath(path, options);
      if (path.includes('roomId')) {
        const url = new URL(path, 'https://roulette-app.vercel.app');
        const roomId = url.searchParams.get('roomId');
        if (roomId && state?.routes) {
          const welcomeRoute = state.routes.find(r => r.name === 'Welcome');
          if (welcomeRoute) {
            welcomeRoute.params = { ...welcomeRoute.params, roomId };
          }
        }
      }
      return state;
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
