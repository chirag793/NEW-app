import { Tabs } from "expo-router";
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4ECDC4",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E5EA",
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: "#FFFFFF",
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#E5E5EA",
        },
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="timer"
        options={{
          title: "Study Timer",
          tabBarIcon: ({ color }) => <Ionicons name="timer" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="tests"
        options={{
          title: "Test Scores",
          tabBarIcon: ({ color }) => <FontAwesome name="bar-chart" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color }) => <FontAwesome name="bullseye" size={24} color={color} />, 
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}