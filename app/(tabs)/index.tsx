import React from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStudy } from '@/hooks/study-context';
import { useAdManager } from '@/hooks/ad-context';
import { MaterialIcons } from '@expo/vector-icons';
import AdBanner from '@/components/AdBanner';
import InterstitialAd from '@/components/InterstitialAd';

export default function DashboardScreen() {
  const { getWeeklyStats, isLoading } = useStudy();
  const { showBannerAds, interstitialAdVisible, hideInterstitialAd } = useAdManager();
  const insets = useSafeAreaInsets();

  const weeklyStats = getWeeklyStats?.() ?? [];

  if (isLoading) return (<View style={styles.loading}><ActivityIndicator /> </View>);

  return (
    <View style={styles.screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="access-time" size={20} color="#4ECDC4" />
            <Text style={styles.sectionTitle}>This Week</Text>
          </View>
          <View style={styles.weekChart}>
            {weeklyStats.map((d: any) => (
              <View key={d.date} style={styles.dayColumn}>
                <View style={styles.bar} />
                <Text style={styles.dayLabel}>{new Date(d.date).toLocaleDateString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {showBannerAds && (
          <View style={styles.adContainer}>
            <AdBanner size="medium" />
          </View>
        )}

      </ScrollView>

      <InterstitialAd visible={interstitialAdVisible} onClose={hideInterstitialAd} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F9FA' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, marginBottom: 12, backgroundColor: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { marginLeft: 8, fontSize: 16, fontWeight: '600' },
  weekChart: { flexDirection: 'row', justifyContent: 'space-between', height: 100 },
  dayColumn: { flex: 1, alignItems: 'center' },
  bar: { width: '60%', height: 32, backgroundColor: '#B2E5E1', borderRadius: 6 },
  dayLabel: { marginTop: 8, fontSize: 12, color: '#8E8E93' },
  adContainer: { paddingHorizontal: 16, marginBottom: 12 },
});
