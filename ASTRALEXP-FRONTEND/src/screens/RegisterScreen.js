import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const layout       = useLayout();
  const [email,    setEmail]    = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password,  setPwd]     = useState('');
  const [password2, setPwd2]    = useState('');
  const [showPwd,   setShowPwd] = useState(false);
  const [loading,   setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password) {
      Alert.alert('Missing fields', 'Email, username and password are required.'); return;
    }
    if (password !== password2) { Alert.alert('Password mismatch', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      await register({ email: email.trim(), username: username.trim(), full_name: fullName.trim(), password, password2 });
      navigation.replace('MainTabs');
    } catch (err) {
      const data = err.response?.data;
      const msg = err.response?.data
        ? Object.values(err.response.data).flat().join('\n')
        : (err.message === 'Network Error' ? 'We are currently unable to connect to our servers. Please check your internet connection and try again.' : 'An unexpected error occurred. Please try again.');
      Alert.alert('Registration Failed', msg);
    } finally { setLoading(false); }
  };

  // ── Desktop / tablet two-column layout ───────────────────────────────────
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
                style={{ width: 56, height: 56, borderRadius: 14 }} 
                resizeMode="contain"
              />
            </View>
            <Text style={styles.heroTitle}>AstralExp</Text>
            <Text style={styles.heroSubtitle}>THE DIGITAL PRIVATE VAULT</Text>
            <View style={styles.heroSeparator} />
            <Text style={styles.heroDesc}>
              Join thousands who track{'\n'}expenses intelligently with{'\n'}AI-powered conversations.
            </Text>
          </View>
        </View>

        {/* Right form */}
        <ScrollView
          style={styles.formPanel}
          contentContainerStyle={styles.formPanelContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create Account</Text>
            <Text style={styles.formSubtitle}>Enter the digital private vault</Text>
            <View style={styles.accentBar} />
            <FormBody 
              state={{ email, username, fullName, password, password2, showPwd, loading }}
              setters={{ setEmail, setUsername, setFullName, setPwd, setPwd2, setShowPwd, handleRegister }}
              navigation={navigation}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Mobile layout (original) ──────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.glob1} />
      <View style={styles.glob2} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.iconWrap}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={{ width: 44, height: 44, borderRadius: 10 }} 
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appTitle}>Create Account</Text>
          <Text style={styles.appSubtitle}>Enter the Digital Private Vault</Text>
        </View>
        <View style={[styles.card, { position: 'relative', overflow: 'hidden' }]}>
          <View style={styles.accentBarMobile} />
          <FormBody 
            state={{ email, username, fullName, password, password2, showPwd, loading }}
            setters={{ setEmail, setUsername, setFullName, setPwd, setPwd2, setShowPwd, handleRegister }}
            navigation={navigation}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

const Field = ({ label, icon, value, onChange, placeholder, secureText, keyboardType, autoCapitalize, extra }) => (
  <View style={styles.fieldGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={Colors.onSurfaceVariant} style={styles.inputIcon} />
      <TextInput
        style={[styles.input, { flex: 1 }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.outline}
        secureTextEntry={secureText}
        keyboardType={keyboardType || 'default'}
        autoCapitalize={autoCapitalize || 'none'}
        autoCorrect={false}
      />
      {extra}
    </View>
  </View>
);

const FormBody = ({ state, setters, navigation }) => {
  const { email, username, fullName, password, password2, showPwd, loading } = state;
  const { setEmail, setUsername, setFullName, setPwd, setPwd2, setShowPwd, handleRegister } = setters;

  return (
    <>
      <Field label="EMAIL ADDRESS"    icon="mail-outline"           value={email}    onChange={setEmail}    placeholder="name@example.com" keyboardType="email-address" />
      <Field label="USERNAME"         icon="person-outline"         value={username} onChange={setUsername} placeholder="yourhandle" />
      <Field label="FULL NAME"        icon="id-card-outline"        value={fullName} onChange={setFullName} placeholder="Your full name" autoCapitalize="words" />
      <Field label="PASSWORD"         icon="lock-closed-outline"    value={password} onChange={setPwd}      placeholder="••••••••" secureText={!showPwd}
        extra={
          <TouchableOpacity onPress={() => setShowPwd(!showPwd)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
            <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        }
      />
      <Field label="CONFIRM PASSWORD" icon="shield-checkmark-outline" value={password2} onChange={setPwd2} placeholder="••••••••" secureText />

      <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <><Text style={styles.btnText}>Create Account</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
        }
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.footerLink}> Log in</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  // ── Mobile ──────────────────────────────────────────────────────────────
  root:    { flex:1, backgroundColor:Colors.background },
  glob1:   { position:'absolute', top:'-5%', left:'-10%', width:280, height:280, borderRadius:140, backgroundColor:Colors.primaryContainer, opacity:0.09 },
  glob2:   { position:'absolute', bottom:'-5%', right:'-10%', width:280, height:280, borderRadius:140, backgroundColor:Colors.tertiaryContainer, opacity:0.04 },
  scroll:  { flexGrow:1, alignItems:'center', justifyContent:'center', paddingHorizontal:Spacing.lg, paddingVertical:Spacing.xl },
  brand:   { alignItems:'center', marginBottom:Spacing.lg, gap:8 },
  iconWrap:{ width:60, height:60, borderRadius:16, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center', marginBottom:4, shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:14, elevation:8 },
  appTitle:   { fontSize:30, fontWeight:'800', color:Colors.onSurface, letterSpacing:-0.5 },
  appSubtitle:{ fontSize:11, color:Colors.onSurfaceVariant, letterSpacing:1, fontWeight:'500' },
  card:       { width:'100%', backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.lg, padding:Spacing.lg, gap:Spacing.md },
  accentBarMobile: { position:'absolute', top:0, left:0, right:0, height:2, backgroundColor:Colors.primaryContainer, opacity:0.5 },

  // ── Shared ───────────────────────────────────────────────────────────────
  fieldGroup: { gap:5 },
  label:      { fontSize:9, color:Colors.onSurfaceVariant, letterSpacing:2, fontWeight:'700', marginLeft:4 },
  inputWrap:  { flexDirection:'row', alignItems:'center', backgroundColor:Colors.surfaceContainerLowest, borderRadius:Radius.md, paddingHorizontal:14, height:50 },
  inputIcon:  { marginRight:10 },
  input:      { flex:1, fontSize:15, color:Colors.onSurface, paddingVertical:0 },
  btn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, height:52, borderRadius:Radius.full, backgroundColor:Colors.primaryContainer, marginTop:4, shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:16, elevation:8 },
  btnText:    { fontSize:16, fontWeight:'700', color:'#fff' },
  footer:     { flexDirection:'row', alignItems:'center', marginTop:Spacing.sm },
  footerText: { color:Colors.onSurfaceVariant, fontSize:14 },
  footerLink: { color:Colors.primary, fontWeight:'700', fontSize:14 },

  // ── Desktop ──────────────────────────────────────────────────────────────
  desktopRoot:      { flex:1, flexDirection:'row', backgroundColor:Colors.background },
  heroPanel:        { flex:1, backgroundColor:Colors.surfaceContainerLowest, alignItems:'center', justifyContent:'center', padding:60, overflow:'hidden', borderRightWidth:1, borderRightColor:Colors.outlineVariant+'30', position:'relative' },
  heroBg1:          { position:'absolute', top:'-15%', left:'-15%', width:500, height:500, borderRadius:250, backgroundColor:Colors.primaryContainer, opacity:0.08 },
  heroBg2:          { position:'absolute', bottom:'-10%', right:'-10%', width:400, height:400, borderRadius:200, backgroundColor:Colors.tertiaryContainer, opacity:0.05 },
  heroContent:      { alignItems:'flex-start', gap:16, maxWidth:400, width:'100%', zIndex:2 },
  heroIconWrap:     { width:80, height:80, borderRadius:22, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center', shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:12}, shadowOpacity:0.4, shadowRadius:28, elevation:12 },
  heroTitle:        { fontSize:50, fontWeight:'800', color:Colors.onSurface, letterSpacing:-2 },
  heroSubtitle:     { fontSize:10, color:Colors.onSurfaceVariant, letterSpacing:4, fontWeight:'700' },
  heroSeparator:    { width:40, height:2, backgroundColor:Colors.primaryContainer, borderRadius:1, marginVertical:4 },
  heroDesc:         { fontSize:16, color:Colors.onSurfaceVariant, lineHeight:26, letterSpacing:0.2 },
  formPanel:        { flex:1 },
  formPanelContent: { flex:1, alignItems:'center', justifyContent:'center', padding:60 },
  formCard:         { width:'100%', maxWidth:480, gap:Spacing.md, position:'relative', overflow:'hidden' },
  formTitle:        { fontSize:36, fontWeight:'800', color:Colors.onSurface, letterSpacing:-1, marginBottom:2 },
  formSubtitle:     { fontSize:14, color:Colors.onSurfaceVariant, marginBottom:4 },
  accentBar:        { height:2, backgroundColor:Colors.primaryContainer, borderRadius:1, opacity:0.5, marginBottom:8 },
});
