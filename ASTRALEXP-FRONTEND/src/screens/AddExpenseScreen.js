import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, CATEGORIES, CURRENCY_SYMBOLS } from '../theme';
import { expensesAPI, paymentsAPI, friendsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';

export default function AddExpenseScreen({ route, navigation }) {
  const { user } = useAuth();
  const layout   = useLayout();
  const currSym = CURRENCY_SYMBOLS[user?.preferred_currency || 'INR'] || '₹';
  const expense = route.params?.expense; // If editing

  const [amount, setAmount]     = useState(expense ? String(expense.amount) : '');
  const [note, setNote]         = useState(expense?.note || '');
  const [cat, setCat]           = useState(expense?.category || 'other');
  const [pmId, setPmId]         = useState(expense?.payment_method || null);
  const [payMethods, setPms]    = useState([]);
  const [friends, setFriends]   = useState([]);
  const [splits, setSplits]     = useState(
    expense?.splits ? expense.splits.map(s => ({ debtor: s.debtor, amount: String(s.amount) })) : []
  ); // { debtor: id, amount: str }
  const [isSplitting, setIsSplitting] = useState(expense?.splits && expense.splits.length > 0);
  const [loading, setLoading]   = useState(false);

  useEffect(() => { loadPms(); loadFriends(); }, []);

  const loadFriends = async () => {
    try {
      const res = await friendsAPI.list();
      setFriends(res.data);
    } catch {}
  };

  const loadPms = async () => {
    try {
      const res = await paymentsAPI.list();
      const pms = res.data.results || res.data || [];
      setPms(pms);
      if (!expense && !pmId && pms.length > 0) {
        const def = pms.find(p => p.is_default);
        if (def) setPmId(def.id);
      }
    } catch {}
  };

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }

    setLoading(true);
    try {
      const payload = {
        category: cat, note: note.trim(),
        payment_method: pmId,
        expense_time: expense?.expense_time || new Date().toISOString(),
        splits: isSplitting ? splits.map(s => ({ debtor: s.debtor, amount: parseFloat(s.amount) || 0 })) : [],
      };
      if (expense) await expensesAPI.update(expense.id, payload);
      else await expensesAPI.create(payload);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.detail || 'Failed to save expense.');
    } finally { setLoading(false); }
  };

  const handleDelete = () => {
    if (!expense) return;
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await expensesAPI.delete(expense.id);
          navigation.goBack();
        } catch { Alert.alert('Error', 'Failed to delete.'); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Ionicons name="close" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>{expense ? 'Edit Expense' : 'Add Expense'}</Text>
        {expense ? (
          <TouchableOpacity onPress={handleDelete} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, layout.isLargeScreen && styles.scrollContentDesktop]} keyboardShouldPersistTaps="handled">
          {/* Amount Hero */}
          <View style={styles.heroWrap}>
            <Text style={styles.currency}>{currSym}</Text>
            <TextInput
              style={styles.amtInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.outlineVariant}
              autoFocus={!expense}
            />
          </View>

          {/* Note Input */}
          <View style={styles.noteWrap}>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="What was this for?"
              placeholderTextColor={Colors.outline}
              maxLength={100}
            />
          </View>

          {/* Categories Bento Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => {
                const isActive = cat === c.id;
                return (
                  <TouchableOpacity key={c.id} style={[styles.catBtn, isActive && styles.catBtnActive]} onPress={() => setCat(c.id)} activeOpacity={0.7}>
                    <Ionicons name={catToIonicon(c.id)} size={18} color={isActive ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
                    <Text style={[styles.catText, isActive && styles.catTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Payment Method Select */}
          <View style={[styles.section, { marginBottom: Spacing.xxl }]}>
            <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {payMethods.map(pm => {
                const isActive = pmId === pm.id;
                const pmAmt = pm.balance != null ? parseFloat(pm.balance) : null;
                const parsedAmt = amount ? parseFloat(amount) : 0;
                const isInsufficient = pmAmt != null && pmAmt < parsedAmt;
                const balStr = pmAmt != null ? ` (${currSym}${pmAmt.toFixed(0)})` : '';
                return (
                  <TouchableOpacity 
                    key={pm.id} 
                    style={[styles.pmBtn, isActive && styles.pmBtnActive, isInsufficient && !isActive && { opacity: 0.5 }]} 
                    onPress={() => {
                        if (isInsufficient && !isActive && !expense) Alert.alert('Insufficient Balance', `You only have ${currSym}${pmAmt} in ${pm.name}.`);
                        else setPmId(pm.id);
                    }} 
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isInsufficient && !isActive && !expense ? "lock-closed" : pmToIonicon(pm.type)} size={16} color={isActive ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
                    <Text style={[styles.pmText, isActive && styles.pmTextActive]}>{pm.name}{balStr}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[styles.pmBtn, pmId === null && styles.pmBtnActive]} onPress={() => setPmId(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle-outline" size={16} color={pmId === null ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
                <Text style={[styles.pmText, pmId === null && styles.pmTextActive]}>None</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Split with Friends Section */}
          <View style={styles.section}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <Text style={styles.sectionLabel}>SPLIT WITH FRIENDS</Text>
              <TouchableOpacity onPress={() => setIsSplitting(!isSplitting)}>
                <Text style={{ fontSize:12, fontWeight:'700', color: isSplitting ? Colors.primary : Colors.outline }}>
                  {isSplitting ? 'CANCEL' : 'ADD SPLIT'}
                </Text>
              </TouchableOpacity>
            </View>

            {isSplitting && (
              <View style={styles.splitBox}>
                {friends.length === 0 ? (
                  <Text style={styles.emptyText}>No friends found. Add friends to split! </Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    {friends.map(f => {
                      const split = splits.find(s => s.debtor === f.id);
                      return (
                        <View key={f.id} style={styles.friendRow}>
                          <View style={{ flexDirection:'row', alignItems:'center', flex:1 }}>
                            <View style={[styles.avatarSmall, { backgroundColor: Colors.surfaceContainerHigh }]}>
                              <Text style={{ fontSize:10, fontWeight:'700' }}>{(f.full_name || f.username)[0].toUpperCase()}</Text>
                            </View>
                            <Text style={styles.friendName} numberOfLines={1}>{f.full_name || f.username}</Text>
                          </View>
                          
                          <View style={styles.splitInpWrap}>
                            <Text style={styles.splitCurr}>{currSym}</Text>
                            <TextInput
                              style={styles.splitInp}
                              placeholder="0"
                              keyboardType="decimal-pad"
                              value={split?.amount || ''}
                              onChangeText={(val) => {
                                let newSplits = [...splits];
                                const idx = newSplits.findIndex(s => s.debtor === f.id);
                                if (val) {
                                  if (idx >= 0) newSplits[idx].amount = val;
                                  else newSplits.push({ debtor: f.id, amount: val });
                                } else {
                                  if (idx >= 0) newSplits.splice(idx, 1);
                                }
                                setSplits(newSplits);
                              }}
                            />
                          </View>
                        </View>
                      );
                    })}
                    
                    {splits.length > 0 && (
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Friends owe: {currSym}{splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0).toFixed(2)}</Text>
                        <Text style={styles.yourShare}>Your share: {currSym}{(parseFloat(amount || 0) - splits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0)).toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.btn} onPress={handleSave} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{expense ? 'Update Expense' : 'Save Expense'}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function catToIonicon(id) {
  const m = { food:'restaurant', groceries:'cart', transport:'car', shopping:'bag', entertainment:'film', health:'medical', utilities:'flash', education:'school', travel:'airplane', rent:'home', subscription:'refresh', other:'ellipsis-horizontal' };
  return m[id] || 'ellipsis-horizontal';
}
function pmToIonicon(type) {
  const m = { upi:'phone-portrait', bank:'business', card:'card', cash:'cash', wallet:'wallet', other:'file-tray' };
  return m[type] || 'cash';
}

const styles = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:Spacing.lg, paddingVertical:12 },
  backBtn:     { width:40, height:40, borderRadius:20, backgroundColor:Colors.surfaceContainerHigh, alignItems:'center', justifyContent:'center' },
  title:       { fontSize:15, fontWeight:'700', color:Colors.onSurface, letterSpacing:1, textTransform:'uppercase' },
  scroll:      { flex:1 },
  scrollContent:{ paddingHorizontal:Spacing.lg, paddingTop:Spacing.lg, paddingBottom:120 },
  scrollContentDesktop: { paddingHorizontal: 40, maxWidth: 760, alignSelf: 'center', width: '100%' },
  heroWrap:    { flexDirection:'row', alignItems:'flex-start', justifyContent:'center', marginBottom:Spacing.lg },
  currency:    { fontSize:28, fontWeight:'700', color:Colors.onSurfaceVariant, marginTop:8, marginRight:4 },
  amtInput:    { fontSize:56, fontWeight:'800', color:Colors.tertiary, letterSpacing:-2 },
  noteWrap:    { backgroundColor:Colors.surfaceContainerLowest, borderRadius:Radius.md, paddingHorizontal:Spacing.md, height:56, justifyContent:'center', marginBottom:Spacing.xl },
  noteInput:   { fontSize:16, color:Colors.onSurface },
  section:     { marginBottom:Spacing.lg },
  sectionLabel:{ fontSize:10, color:Colors.onSurfaceVariant, letterSpacing:3, fontWeight:'700', marginBottom:12 },
  catGrid:     { flexDirection:'row', flexWrap:'wrap', gap:8 },
  catBtn:      { width:'31%', height:64, backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.md, alignItems:'center', justifyContent:'center', gap:4 },
  catBtnActive:{ backgroundColor:Colors.primaryContainer },
  catText:     { fontSize:10, color:Colors.onSurfaceVariant, fontWeight:'600' },
  catTextActive:{ color:Colors.onPrimaryContainer },
  pmBtn:       { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:16, height:48, borderRadius:Radius.md, backgroundColor:Colors.surfaceContainerLow },
  pmBtnActive: { backgroundColor:Colors.primaryContainer },
  pmText:      { fontSize:13, color:Colors.onSurfaceVariant, fontWeight:'600' },
  pmTextActive:{ color:Colors.onPrimaryContainer },
  footer:      { padding:Spacing.lg, paddingBottom:Platform.OS === 'ios' ? 0 : Spacing.lg, borderTopWidth:1, borderTopColor:Colors.surfaceContainerHigh },
  btn:         { height:56, borderRadius:Radius.full, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center', shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:16, elevation:8 },
  btnText:     { fontSize:16, fontWeight:'700', color:'#fff' },
  splitBox:    { backgroundColor:Colors.surfaceContainerLowest, borderRadius:Radius.md, padding:Spacing.md },
  friendRow:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:12 },
  avatarSmall: { width:24, height:24, borderRadius:12, alignItems:'center', justifyContent:'center', marginRight:8 },
  friendName:  { fontSize:14, color:Colors.onSurface, flex:1 },
  splitInpWrap:{ flexDirection:'row', alignItems:'center', backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.sm, px:8, width:80, height:32 },
  splitCurr:   { fontSize:12, color:Colors.onSurfaceVariant, paddingLeft:4 },
  splitInp:    { flex:1, fontSize:13, color:Colors.tertiary, fontWeight:'700', textAlign:'right', paddingRight:4 },
  emptyText:   { fontSize:12, color:Colors.outline, textAlign:'center', fontStyle:'italic' },
  summaryRow:  { borderTopWidth:1, borderTopColor:Colors.outlineVariant, paddingTop:8, marginTop:4 },
  summaryLabel:{ fontSize:12, color:Colors.onSurfaceVariant, textAlign:'right' },
  yourShare:   { fontSize:13, color:Colors.onSurface, fontWeight:'700', textAlign:'right' },
});
