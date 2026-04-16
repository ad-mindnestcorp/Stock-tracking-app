import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { registerForPushNotifications } from '@/lib/notifications';
import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split('@')[0] ??
    'User';

  const avatarInitial = displayName.charAt(0).toUpperCase();

  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    if (value) {
      const token = await registerForPushNotifications();
      setPushToken(token);
      if (!token) {
        Alert.alert('Permission denied', 'Please enable notifications in your device settings.');
        setNotificationsEnabled(false);
      }
    }
  };

  const handleTriggerCheck = async () => {
    try {
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      await fetch(`${BASE_URL}/api/push-token/trigger-check`, { method: 'POST' });
      Alert.alert('Alert Check', 'Alert check triggered. Results will appear in Alerts tab shortly.');
    } catch {
      Alert.alert('Error', 'Could not reach backend. Is the server running?');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          {user?.email ? (
            <Text style={styles.userEmail}>{user.email}</Text>
          ) : null}
          {user?.app_metadata?.provider ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {user.app_metadata.provider === 'google' ? '🔐 Google Account' : '📧 Email Account'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={20} color={Colors.textSecondary} />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Alerts for RSI and 52-week signals</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {pushToken && (
            <View style={styles.tokenRow}>
              <Text style={styles.tokenLabel}>Push Token Registered</Text>
              <Ionicons name="checkmark-circle" size={16} color={Colors.positive} />
            </View>
          )}
        </View>

        {/* Developer Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Developer Tools</Text>

          <TouchableOpacity style={styles.devBtn} onPress={handleTriggerCheck}>
            <Ionicons name="play-circle-outline" size={20} color={Colors.primary} />
            <View style={styles.devBtnText}>
              <Text style={styles.devBtnLabel}>Trigger Alert Check Now</Text>
              <Text style={styles.devBtnDesc}>Manually run the monitoring engine</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          {[
            { label: 'Alert Conditions', value: 'RSI > 70, RSI < 30, 52W High, 52W Low' },
            { label: 'Monitoring Interval', value: 'Every 5 minutes (weekdays)' },
            { label: 'Data Source', value: 'Finnhub.io' },
            { label: 'Version', value: '1.0.0' },
          ].map((item) => (
            <View key={item.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={Colors.negative} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="bar-chart" size={18} color={Colors.textMuted} />
          <Text style={styles.footerText}>Stockvest · Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  profileCard: {
    margin: 20,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: 24,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark,
  },
  userName: { fontSize: 20, fontWeight: '800', color: Colors.dark },
  userEmail: { fontSize: 13, color: Colors.dark, opacity: 0.65, marginTop: 4 },
  badge: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.dark },

  section: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: Colors.cardBg,
    borderRadius: Radius.lg,
    padding: 16,
    ...Shadow.card,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  settingDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  tokenLabel: { fontSize: 12, color: Colors.positive, fontWeight: '600' },

  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  devBtnText: { flex: 1 },
  devBtnLabel: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  devBtnDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: { fontSize: 13, color: Colors.textSecondary },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },

  signOutBtn: {
    marginHorizontal: 20,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.negative,
    borderRadius: Radius.lg,
    paddingVertical: 14,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.negative,
  },

  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  footerText: { fontSize: 13, color: Colors.textMuted },
});
