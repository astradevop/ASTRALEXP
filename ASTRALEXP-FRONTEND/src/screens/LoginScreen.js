import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const layout    = useLayout();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { Alert.alert('Missing fields', 'Enter your email and password.'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigation.replace('MainTabs');
    } catch (err) {
      const msg = err.message === 'Network Error'
        ? 'We are currently unable to connect to our servers. Please check your internet connection and try again.'
        : (err.response?.data?.detail || 'An unexpected error occurred. Please try again.');
      Alert.alert('Login Failed', msg);
    } finally { setLoading(false); }
  };

  // ─── Desktop/Tablet split layout ───────────────────────────────────────────
  if (layout.isLargeScreen) {
    return (
      <View style={styles.desktopRoot}>
        {/* Left hero panel */}
        <View style={styles.heroPanel}>
          <View style={styles.heroBg1} />
          <View style={styles.heroBg2} />
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrap}>
                <Image 
                  source={require('../../assets/icon.png')} 
                  style={{ width: 60, height: 60, borderRadius: 14 }} 
                  resizeMode="contain"
                />
            </View>
            <Text style={styles.heroTitle}>AstralExp</Text>
            <Text style={styles.heroSubtitle}>THE DIGITAL PRIVATE VAULT</Text>
            <View style={styles.heroSeparator} />
            <Text style={styles.heroDesc}>
              Intelligent expense tracking with{'\n'}AI-powered chat logging and{'\n'}shared vault management.
            </Text>
            <View style={styles.heroFeatures}>
              {['AI-Powered Chat Logging', 'Shared Expense Vaults', 'Multi-Currency Support', 'Receipt Recognition'].map((f) => (
                <View key={f} style={styles.heroFeatureRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.tertiary} />
                  <Text style={styles.heroFeatureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Right form panel */}
        <ScrollView
          style={styles.formPanel}
          contentContainerStyle={styles.formPanelContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Access your digital vault</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={Colors.outline}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>SECURITY KEY</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.outline}
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={styles.btnText}>Access Ledger</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
              }
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}> Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Mobile layout (unchanged) ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.glob1} />
      <View style={styles.glob2} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.iconWrap}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 56, height: 56, borderRadius: 14 }} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appTitle}>AstralExp</Text>
          <Text style={styles.appSubtitle}>THE DIGITAL PRIVATE VAULT</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={Colors.outline}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>SECURITY KEY</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.outline}
                secureTextEntry={!showPwd}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Text style={styles.btnText}>Access Ledger</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
            }
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}> Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // ── Mobile ──────────────────────────────────────────────────────────────
  root:    { flex: 1, backgroundColor: Colors.background },
  glob1:   { position:'absolute', top:'-5%', left:'-10%', width:300, height:300, borderRadius:150, backgroundColor:Colors.primaryContainer, opacity:0.08 },
  glob2:   { position:'absolute', bottom:'-5%', right:'-10%', width:300, height:300, borderRadius:150, backgroundColor:Colors.tertiaryContainer, opacity:0.04 },
  scroll:  { flexGrow:1, alignItems:'center', justifyContent:'center', paddingHorizontal:Spacing.lg, paddingVertical:Spacing.xxl },
  brand:   { alignItems:'center', marginBottom:Spacing.xl, gap:10 },
  iconWrap:{ width:72, height:72, borderRadius:20, alignItems:'center', justifyContent:'center', backgroundColor:Colors.primaryContainer, shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:8}, shadowOpacity:0.3, shadowRadius:20, elevation:10, marginBottom:4 },
  appTitle:{ fontSize:38, fontWeight:'800', color:Colors.onSurface, letterSpacing:-1 },
  appSubtitle:{ fontSize:10, color:Colors.onSurfaceVariant, letterSpacing:4, fontWeight:'600' },
  card:    { width:'100%', backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.lg, padding:Spacing.lg, gap:Spacing.md },

  // ── Shared fields / btn / footer ────────────────────────────────────────
  fieldGroup: { gap: 6 },
  label:      { fontSize:9, color:Colors.onSurfaceVariant, letterSpacing:2, fontWeight:'700', marginLeft:4 },
  inputWrap:  { flexDirection:'row', alignItems:'center', backgroundColor:Colors.surfaceContainerLowest, borderRadius:Radius.md, paddingHorizontal:14, height:52 },
  inputIcon:  { marginRight:10 },
  input:      { flex:1, fontSize:15, color:Colors.onSurface, paddingVertical:0 },
  btn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, height:54, borderRadius:Radius.full, backgroundColor:Colors.primaryContainer, marginTop:4, shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:16, elevation:8 },
  btnText:    { fontSize:16, fontWeight:'700', color:'#fff' },
  footer:     { flexDirection:'row', alignItems:'center', marginTop:Spacing.lg },
  footerText: { color:Colors.onSurfaceVariant, fontSize:14 },
  footerLink: { color:Colors.primary, fontWeight:'700', fontSize:14 },

  // ── Desktop (split panel) ────────────────────────────────────────────────
  desktopRoot: { flex:1, flexDirection:'row', backgroundColor:Colors.background },

  heroPanel: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
    overflow: 'hidden',
    borderRightWidth: 1,
    borderRightColor: Colors.outlineVariant + '30',
    position: 'relative',
  },
  heroBg1: { position:'absolute', top:'-15%', left:'-15%', width:500, height:500, borderRadius:250, backgroundColor:Colors.primaryContainer, opacity:0.08 },
  heroBg2: { position:'absolute', bottom:'-10%', right:'-10%', width:400, height:400, borderRadius:200, backgroundColor:Colors.tertiaryContainer, opacity:0.05 },
  heroContent: { alignItems:'flex-start', gap:16, maxWidth:400, width:'100%', zIndex:2 },
  heroIconWrap:{ width:80, height:80, borderRadius:22, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center', shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:12}, shadowOpacity:0.4, shadowRadius:28, elevation:12 },
  heroTitle:   { fontSize:50, fontWeight:'800', color:Colors.onSurface, letterSpacing:-2 },
  heroSubtitle:{ fontSize:10, color:Colors.onSurfaceVariant, letterSpacing:4, fontWeight:'700' },
  heroSeparator:{ width:40, height:2, backgroundColor:Colors.primaryContainer, borderRadius:1, marginVertical:4 },
  heroDesc:    { fontSize:16, color:Colors.onSurfaceVariant, lineHeight:26, letterSpacing:0.2 },
  heroFeatures:{ gap:10, marginTop:8 },
  heroFeatureRow:{ flexDirection:'row', alignItems:'center', gap:10 },
  heroFeatureText:{ fontSize:14, color:Colors.onSurface, fontWeight:'500' },

  formPanel:        { flex:1 },
  formPanelContent: { flex:1, alignItems:'center', justifyContent:'center', padding:60 },
  formCard:         { width:'100%', maxWidth:440, gap:Spacing.md },
  formTitle:        { fontSize:36, fontWeight:'800', color:Colors.onSurface, letterSpacing:-1, marginBottom:4 },
  formSubtitle:     { fontSize:14, color:Colors.onSurfaceVariant, marginBottom:8 },
});
