import "./global.css";
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from './src/screens/WelcomeScreen';
import NameInputScreen from './src/screens/NameInputScreen';
import RouletteScreen from './src/screens/RouletteScreen';
import ResultScreen from './src/screens/ResultScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { Colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

export default function App() {
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
