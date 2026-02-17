import "./global.css";
import "./src/i18n";
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './src/screens/WelcomeScreen';
import NameInputScreen from './src/screens/NameInputScreen';
import RouletteScreen from './src/screens/RouletteScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
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

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="NameInput" component={NameInputScreen} />
        <Stack.Screen name="Roulette" component={RouletteScreen} />
        <Stack.Screen name="Result" component={ResultScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
