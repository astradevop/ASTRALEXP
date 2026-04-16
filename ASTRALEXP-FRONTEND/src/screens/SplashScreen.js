import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const { user, loading } = useAuth();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.85)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      navigation.replace(user ? 'MainTabs' : 'Login');
    }, 1800);
    return () => clearTimeout(timer);
  }, [loading, user]);

  return (
    <View style={styles.container}>
      {/* Ambient glow blobs */}
      <View style={styles.glob1} />
      <View style={styles.glob2} />

      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={styles.iconWrap}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={{ width: 64, height: 64, borderRadius: 12 }} 
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>AstralExp</Text>
        <Text style={styles.subtitle}>FINANCIAL FLUIDITY</Text>
      </Animated.View>

      <View style={styles.loader}>
        <View style={styles.loaderTrack}>
          <Animated.View style={[styles.loaderBar, {
            width: glowAnim.interpolate({ inputRange: [0,1], outputRange: ['30%','70%'] }),
          }]} />
        </View>
        <Text style={styles.loaderText}>INITIALIZING VAULT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glob1: {
    position: 'absolute', top: '-10%', left: '-10%',
    width: width * 0.5, height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: Colors.primaryContainer,
    opacity: 0.08,
  },
  glob2: {
    position: 'absolute', bottom: '-10%', right: '-10%',
    width: width * 0.5, height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: Colors.tertiaryContainer,
    opacity: 0.05,
  },
  content: { alignItems: 'center', gap: 16 },
  iconWrap: {
    width: 96, height: 96,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 32, elevation: 10,
  },
  title: {
    fontFamily: 'System',
    fontSize: 40, fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 11, color: Colors.onSurfaceVariant,
    letterSpacing: 4, opacity: 0.6, fontWeight: '600',
  },
  loader: {
    position: 'absolute', bottom: 64,
    alignItems: 'center', gap: 12,
  },
  loaderTrack: {
    width: 48, height: 4,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 2, overflow: 'hidden',
  },
  loaderBar: {
    height: '100%',
    backgroundColor: Colors.primaryContainer,
    borderRadius: 2,
  },
  loaderText: {
    fontSize: 9, color: Colors.onSurfaceVariant,
    letterSpacing: 3, opacity: 0.4, fontWeight: '600',
  },
});
