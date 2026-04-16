import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
  Platform, SafeAreaView, Keyboard, StatusBar, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Colors, Spacing, Radius, CATEGORIES, CURRENCY_SYMBOLS } from '../theme';
import { chatAPI, expensesAPI, paymentsAPI, friendsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';

const GREET_HOUR = new Date().getHours();
const GREETING   = GREET_HOUR < 12 ? '☀️ Good morning' : GREET_HOUR < 17 ? '🌤 Good afternoon' : '🌙 Good evening';

export default function ChatScreen({ navigation }) {
  const { user } = useAuth();
  const layout   = useLayout();
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [payMethods, setPayMethods] = useState([]);
  const [friends,    setFriends]    = useState([]);
  const [pendingParsed, setPending] = useState(null);
  const listRef = useRef(null);

  const currSym = CURRENCY_SYMBOLS[user?.preferred_currency || 'INR'] || '₹';

  useEffect(() => {
    loadPaymentMethods();
    loadFriends();
    loadHistory();

    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('CLEAR_CHAT_HISTORY', () => {
      setMessages([]);
      loadHistory();
    });
    return () => sub.remove();
  }, []);

  const loadHistory = async () => {
    try {
      // Load message history
      const saved = await AsyncStorage.getItem(`chat_history_${user?.id}`);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        pushBot(
          `${GREETING}, ${user?.full_name?.split(' ')[0] || 'there'}! 👋\n\nI'm your expense assistant. Tell me what you spent or upload a receipt.\n\nTry: _"Had biriyani for 180 via GPay"_`
        );
      }

      // Load pending AI context (persistence fix)
      const savedPending = await AsyncStorage.getItem(`chat_pending_state_${user?.id}`);
      if (savedPending) {
        setPending(JSON.parse(savedPending));
      }
    } catch {
      pushBot(
        `${GREETING}, ${user?.full_name?.split(' ')[0] || 'there'}! 👋\n\nI'm your expense assistant. Tell me what you spent or upload a receipt.\n\nTry: _"Had biriyani for 180 via GPay"_`
      );
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const res = await paymentsAPI.list();
      const data = res.data?.results || res.data;
      setPayMethods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    }
  };

  useEffect(() => {
    const saveState = async () => {
      try {
        // Save chat history
        const persistable = messages.filter(m => m.role !== 'chips');
        if (persistable.length > 0) {
          await AsyncStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(persistable));
        }

        // Save pending AI context (persistence fix)
        if (pendingParsed) {
          await AsyncStorage.setItem(`chat_pending_state_${user?.id}`, JSON.stringify(pendingParsed));
        } else {
          await AsyncStorage.removeItem(`chat_pending_state_${user?.id}`);
        }
      } catch (err) {
        console.error('Failed to persist chat state:', err);
      }
    };
    saveState();
  }, [messages, pendingParsed, user]);

  const loadFriends = async () => {
    try {
      const res = await friendsAPI.list();
      const data = res.data?.results || res.data;
      setFriends(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const pushUser = (text, image) => setMessages(prev => [...prev, { id: Date.now() + 'u', role: 'user', text, image, time: new Date() }]);
  const pushBot  = (text) => setMessages(prev => [...prev, { id: Date.now() + 'b', role: 'bot',  text, time: new Date() }]);
  const pushChips= (chips) => setMessages(prev => [...prev, { id: Date.now() + 'c', role: 'chips', chips }]);

  const scrollToBottom = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset.base64) {
        send(`data:image/jpeg;base64,${asset.base64}`, asset.uri);
      }
    }
  };

  const send = async (photoBase64 = null, photoUri = null, textOverride = null, explicitContext = null) => {
    let msg = textOverride !== null ? textOverride.trim() : input.trim();
    if (!msg && !photoBase64) return;
    if (sending) return;
    if (textOverride === null) setInput('');
    Keyboard.dismiss();
    pushUser(msg, photoUri);
    setSending(true);
    scrollToBottom();

    let prevContext = null;
    if (explicitContext && !photoBase64 && !explicitContext.is_complete_action) {
      prevContext = explicitContext.parsed;
    } else if (pendingParsed && !photoBase64 && !pendingParsed.is_complete_action) {
      prevContext = pendingParsed.parsed;
    }

    if (photoBase64) setPending(null);

    try {
      const payload = { message: msg, save: false };
      if (photoBase64) payload.image = photoBase64;
      if (prevContext) payload.previous_state = prevContext;

      const res = await chatAPI.parse(payload);
      const { parsed: p, is_complete, follow_up } = res.data;

      if (is_complete) {
        setPending({ message: msg, parsed: p, is_complete_action: true });
        const pmName = p.payment_method_name || '—';
        const expTime = p.expense_time ? new Date(p.expense_time).toLocaleString() : 'Now';
        pushBot(
          `Got it! Here's what I captured:\n\n` +
          `💰 **Amount:** ${currSym}${p.amount}\n` +
          `📂 **Category:** ${capitalize(p.category)}\n` +
          `💳 **Via:** ${pmName}\n` +
          `🕒 **When:** ${expTime}\n\n` +
          `Shall I save this?`
        );
        pushChips([
          { label: '✅ Save it', onPress: () => saveParsed({ message: msg, parsed: p }) },
          { label: '✏️ Edit manually', onPress: () => navigation.navigate('ExpensesTab') },
          { label: '❌ Discard', onPress: () => { setPending(null); pushBot('Discarded. 👍'); } },
        ]);
      } else {
        setPending({ parsed: p, is_complete_action: false });
        pushBot(follow_up || 'Could you provide more details?');
        if (p?.missing_fields?.includes('payment_method')) {
          const sufficient = (payMethods || []).filter(pm =>
            pm.balance == null || parseFloat(pm.balance) >= (p.amount || 0)
          ).slice(0, 4);

          if (sufficient.length > 0) {
            pushChips(sufficient.map(pm => {
              const balStr = pm.balance != null ? `${currSym}${parseFloat(pm.balance).toFixed(0)}` : '';
              const labelStr = balStr ? `${pm.name} (${balStr})` : pm.name;
              return {
                label: labelStr,
                onPress: () => send(null, null, `via ${pm.name}`, { parsed: p, is_complete_action: false }),
              };
            }));
          }
        }

        if (p.needs_friend_selection && (friends || []).length) {
          pushBot("Which friends should I split this with?");
          pushChips((friends || []).map(f => ({
            label: `👤 ${f.full_name || f.username}`,
            onPress: () => {
              const updatedSplits = [...(p.splits || [])];
              if (!updatedSplits.find(s => s.friend_id === f.id)) {
                updatedSplits.push({ friend_id: f.id, amount: null });
              }
              const updatedParsed = { ...p, splits: updatedSplits, needs_friend_selection: false };
              send(null, null, `with ${f.full_name || f.username}`, { parsed: updatedParsed, is_complete_action: false });
            }
          })));
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Network error. Is the backend running?';
      pushBot(`❌ ${errMsg}`);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const saveParsed = async ({ message, parsed: p }) => {
    setPending(null);
    let pmId = null;
    if (p.payment_method_name) {
      const match = (payMethods || []).find(pm =>
        pm.name.toLowerCase().includes(p.payment_method_name.toLowerCase())
      );
      if (match) pmId = match.id;
    }

    let processedSplits = [];
    const splitsList = p.splits || [];
    if (splitsList.length > 0) {
      const totalAmount = parseFloat(p.amount) || 0;
      const calculateEqual = splitsList.some(s => s.amount == null || s.amount === 0);
      
      // Calculate equal valid splits only internally known (where friend_id is valid)
      const validSplits = splitsList.filter(s => (s.friend_id || s.debtor));
      const equalShare = calculateEqual ? Number((totalAmount / (validSplits.length + 1)).toFixed(2)) : 0;
      
      processedSplits = validSplits.map(s => ({
        debtor: s.friend_id || s.debtor,
        amount: calculateEqual ? equalShare : (parseFloat(s.amount) || 0)
      }));
    }

    try {
      const payload = {
        amount: p.amount, category: p.category || 'other',
        note: p.note || message,
        expense_time: p.expense_time || new Date().toISOString(),
        payment_method: pmId, raw_input: message,
        splits: processedSplits,
      };
      await expensesAPI.create(payload);
      pushBot(`✅ **Saved!** ${currSym}${p.amount} for **${capitalize(p.category)}**`);
      pushChips([
        { label: '📋 View Expenses', onPress: () => navigation.navigate('ExpensesTab') },
        { label: '➕ Add Another', onPress: () => {} },
      ]);
    } catch (err) {
      const errDetails = err?.response?.data;
      console.error('Save error:', errDetails || err);
      const errStr = typeof errDetails === 'object' ? JSON.stringify(errDetails) : '';
      pushBot(`❌ Failed to save. Try again. ${errStr}`);
    }
    scrollToBottom();
  };

  const renderItem = ({ item }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <View style={[styles.userBubble, item.image && !item.text && { padding: 4 }]}>
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={[styles.chatImage, item.text && { marginBottom: 8 }]}
              />
            )}
            {!!item.text && <Text style={styles.userText}>{item.text}</Text>}
          </View>
          <Text style={styles.timestamp}>{fmtTime(item.time)}</Text>
        </View>
      );
    }
    if (item.role === 'bot') {
      return (
        <View style={styles.botRow}>
          <View style={styles.botBubble}>
            <Text style={styles.botText}>{renderMarkdown(item.text)}</Text>
          </View>
          <Text style={[styles.timestamp, { marginLeft: 4 }]}>{fmtTime(item.time)} • AstralExp</Text>
        </View>
      );
    }
    if (item.role === 'chips') {
      return (
        <View style={styles.chipsRow}>
          {item.chips.map((chip, i) => (
            <TouchableOpacity key={i} style={styles.chip} onPress={chip.onPress} activeOpacity={0.75}>
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return null;
  };

  const fullAvatarUrl = user?.avatar && !user.avatar.startsWith('file:') && !user.avatar.startsWith('data:') && !user.avatar.startsWith('http')
    ? `http://3.111.206.12${user.avatar}`
    : user?.avatar;

  // Desktop chat is centered with a max-width like WhatsApp Web / Discord
  const chatMaxWidth = layout.isDesktop ? 860 : layout.isTablet ? 700 : null;

  return (
    <SafeAreaView style={[styles.root, { paddingLeft: layout.sidebarWidth }]}>
      {/* Header */}
      <View style={[styles.header, layout.isLargeScreen && styles.headerDesktop]}>
        <View style={[styles.headerInner, chatMaxWidth && { maxWidth: chatMaxWidth, width: '100%', alignSelf: 'center' }]}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarSmall}>
              {fullAvatarUrl ? (
                <Image source={{ uri: fullAvatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
              ) : (
                <Ionicons name="person" size={18} color="#fff" />
              )}
            </View>
            <View>
              <Text style={styles.headerTitle}>Financial Fluidity</Text>
              <Text style={styles.headerSub}>{GREETING.split(' ').slice(1).join(' ')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ExpensesTab')} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="receipt-outline" size={22} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <View style={[styles.listOuter, layout.isLargeScreen && styles.listOuterDesktop]}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            chatMaxWidth && { maxWidth: chatMaxWidth, width: '100%', alignSelf: 'center' },
          ]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1, width: '100%' }}
        />
      </View>

      {/* Input bar */}
      <View style={[styles.inputBarOuter, layout.isLargeScreen && styles.inputBarOuterDesktop]}>
        <View style={[styles.inputBar, chatMaxWidth && { maxWidth: chatMaxWidth, width: '100%', alignSelf: 'center' }]}>
          <TouchableOpacity onPress={pickImage} style={[styles.addBtn, { marginRight: -4 }]} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={26} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
          <TextInput
            style={styles.textIn}
            value={input}
            onChangeText={setInput}
            placeholder="Type your expense..."
            placeholderTextColor={Colors.outline}
            multiline
            maxLength={400}
            onSubmitEditing={() => send(null, null)}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={() => send(null, null)} disabled={sending} activeOpacity={0.8}>
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function renderMarkdown(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <Text key={i} style={{ fontWeight: '700', color: Colors.tertiary }}>{p.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{p}</Text>;
  });
}

function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

const styles = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  // Header
  header:      { borderBottomWidth:0 },
  headerDesktop:{ borderBottomWidth:1, borderBottomColor:Colors.outlineVariant+'20', backgroundColor:Colors.surfaceContainerLowest+'80' },
  headerInner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:Spacing.lg, paddingVertical:12 },
  headerLeft:  { flexDirection:'row', alignItems:'center', gap:10 },
  avatarSmall: { width:36, height:36, borderRadius:18, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center' },
  headerTitle: { fontSize:17, fontWeight:'700', color:Colors.primary, letterSpacing:-0.3 },
  headerSub:   { fontSize:11, color:Colors.onSurfaceVariant, marginTop:1 },

  // List
  listOuter:        { flex:1 },
  listOuterDesktop: { alignItems:'center' },
  list:        { paddingHorizontal:Spacing.md, paddingVertical:Spacing.md, gap:10 },

  // Bubbles
  userRow:     { alignSelf:'flex-end', alignItems:'flex-end', maxWidth:'75%' },
  userBubble:  { backgroundColor:Colors.primaryContainer, borderRadius:16, borderTopRightRadius:4, padding:Spacing.md },
  userText:    { color:Colors.onPrimaryContainer, fontSize:15, lineHeight:22 },
  botRow:      { alignSelf:'flex-start', alignItems:'flex-start', maxWidth:'75%' },
  botBubble:   { backgroundColor:Colors.surfaceContainerHigh, borderRadius:16, borderTopLeftRadius:4, padding:Spacing.md },
  botText:     { color:Colors.onSurface, fontSize:15, lineHeight:22 },
  timestamp:   { fontSize:10, color:Colors.onSurfaceVariant, marginTop:4, textTransform:'uppercase', letterSpacing:0.5 },
  chatImage:   { width:200, height:200, borderRadius:12, resizeMode:'cover' },
  chipsRow:    { flexDirection:'row', flexWrap:'wrap', gap:8, paddingLeft:4 },
  chip:        { paddingHorizontal:16, paddingVertical:10, borderRadius:Radius.full, backgroundColor:Colors.surfaceContainerHighest, borderWidth:1, borderColor:Colors.outlineVariant+'44' },
  chipText:    { color:Colors.primary, fontSize:13, fontWeight:'500' },

  // Input bar
  inputBarOuter:         { },
  inputBarOuterDesktop:  { borderTopWidth:1, borderTopColor:Colors.outlineVariant+'20', backgroundColor:Colors.surfaceContainerLowest+'60' },
  inputBar:    { flexDirection:'row', alignItems:'flex-end', gap:8, paddingHorizontal:Spacing.md, paddingVertical:12, backgroundColor:'transparent' },
  addBtn:      { width:40, height:40, borderRadius:20, alignItems:'center', justifyContent:'center' },
  textIn:      { flex:1, backgroundColor:Colors.surfaceContainerLowest, borderRadius:Radius.full, paddingHorizontal:16, paddingVertical:10, color:Colors.onSurface, fontSize:14, maxHeight:100 },
  sendBtn:     { width:44, height:44, borderRadius:22, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center', shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:10, elevation:6 },
});
