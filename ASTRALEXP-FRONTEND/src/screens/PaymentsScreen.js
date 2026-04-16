import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, SafeAreaView, RefreshControl,
  Modal, TextInput, KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, PM_TYPES, CURRENCY_SYMBOLS } from '../theme';
import { paymentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';

export default function PaymentsScreen() {
  const { user }   = useAuth();
  const layout     = useLayout();
  const [pms, setPms]               = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId]       = useState(null);
  const [name, setName]                 = useState('');
  const [type, setType]                 = useState('upi');
  const [balance, setBalance]           = useState('');
  const [isDef, setIsDef]               = useState(false);
  const [saving, setSaving]             = useState(false);

  const currSym = CURRENCY_SYMBOLS[user?.preferred_currency || 'INR'] || '₹';
  const maxWidth = layout.isDesktop ? 860 : layout.isTablet ? 700 : null;

  useEffect(() => { loadPms(); }, []);

  const loadPms = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await paymentsAPI.list();
      setPms(res.data.results || res.data);
    } catch { Alert.alert('Error', 'Could not load payment methods.'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); loadPms(true); };

  const openAdd = () => {
    setEditingId(null); setName(''); setType('upi'); setBalance(''); setIsDef(false);
    setModalVisible(true);
  };

  const openEdit = (pm) => {
    setEditingId(pm.id); setName(pm.name); setType(pm.type); setBalance(pm.balance || ''); setIsDef(pm.is_default);
    setModalVisible(true);
  };

  const save = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), type, balance: balance || null, is_default: isDef };
      if (editingId) await paymentsAPI.update(editingId, payload);
      else await paymentsAPI.create(payload);
      setModalVisible(false);
      loadPms();
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally { setSaving(false); }
  };

  const del = () => {
    if (!editingId) return;
    const run = async () => {
      try {
        await paymentsAPI.delete(editingId);
        setModalVisible(false);
        loadPms();
      } catch { Alert.alert('Error', 'Failed to delete.'); }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this payment method?')) {
        run();
      }
    } else {
      Alert.alert('Delete', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  const renderItem = ({ item }) => {
    const isGradient = item.type === 'card' || item.is_default;
    const cardStyle = [styles.card, isGradient && styles.cardGradient];

    return (
      <TouchableOpacity style={cardStyle} onPress={() => openEdit(item)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.cardTypeLabel, isGradient && { color: 'rgba(202,207,255,0.6)' }]}>{item.type.toUpperCase()}</Text>
            <Text style={[styles.cardName, isGradient && { color: Colors.onPrimaryContainer }]}>{item.name}</Text>
          </View>
          <Ionicons name={getIcon(item.type)} size={28} color={isGradient ? Colors.onPrimaryContainer : Colors.onSurfaceVariant} />
        </View>

        <View style={styles.cardFooter}>
          {item.balance != null ? (
            <Text style={[styles.cardBal, isGradient && { color: Colors.onPrimaryContainer }]}>{currSym}{parseFloat(item.balance).toLocaleString('en-IN', {minimumFractionDigits:2})}</Text>
          ) : (
            <Text style={[styles.cardBalEmpty, isGradient && { color: 'rgba(202,207,255,0.6)' }]}>No balance tracked</Text>
          )}

          <View style={styles.pillRow}>
            {item.is_default && <View style={[styles.pill, { backgroundColor: 'rgba(120,220,119,0.15)' }]}><Text style={[styles.pillText, { color: Colors.tertiary }]}>DEFAULT</Text></View>}
            <View style={[styles.pill, isGradient && { backgroundColor: 'rgba(255,255,255,0.08)' }]}><Text style={[styles.pillText, isGradient && { color: 'rgba(202,207,255,0.6)' }]}>{item.type}</Text></View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { paddingLeft: layout.sidebarWidth }]}>
      {/* Header */}
      <View style={[styles.header, layout.isLargeScreen && styles.headerDesktop]}>
        <View style={[styles.headerInner, maxWidth && { maxWidth, width: '100%', alignSelf: 'center' }]}>
          <Text style={styles.headerTitle}>PAYMENT METHODS</Text>
          <TouchableOpacity onPress={openAdd}>
            <Ionicons name="add-circle" size={32} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.contentOuter, layout.isLargeScreen && styles.contentOuterDesktop]}>
        <View style={[styles.contentInner, maxWidth && { maxWidth }]}>
          {loading && !refreshing ? (
            <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
          ) : pms.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="card-outline" size={64} color={Colors.outlineVariant} />
              <Text style={styles.emptyText}>No payment methods yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>+ Add Method</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={pms}
              renderItem={renderItem}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            />
          )}
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBg}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContentWrap}>
            <View style={[styles.modalCard, layout.isLargeScreen && styles.modalCardDesktop]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingId ? 'Edit Method' : 'Add Payment Method'}</Text>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {editingId && (
                    <TouchableOpacity onPress={del}><Ionicons name="trash-outline" size={20} color={Colors.error} /></TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={22} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.input} value={name} onChangeText={setName}
                placeholder="Account Name (e.g. HDFC Bank)" placeholderTextColor={Colors.outline}
              />

              <View style={styles.typeGrid}>
                {PM_TYPES.map(t => (
                  <TouchableOpacity key={t.id} style={[styles.typeBtn, type === t.id && styles.typeBtnAct]} onPress={() => setType(t.id)}>
                    <Text style={[styles.typeText, type === t.id && styles.typeTextAct]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input} value={String(balance)} onChangeText={setBalance}
                placeholder="Current Balance (Optional)" placeholderTextColor={Colors.outline} keyboardType="numeric"
              />

              <TouchableOpacity style={styles.chkRow} onPress={() => setIsDef(!isDef)} activeOpacity={1}>
                <Ionicons name={isDef ? 'checkbox' : 'square-outline'} size={24} color={isDef ? Colors.primaryContainer : Colors.outlineVariant} />
                <Text style={styles.chkText}>Set as default payment method</Text>
              </TouchableOpacity>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSave} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>Save Method</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getIcon(type) {
  const m = { upi:'phone-portrait-outline', bank:'business-outline', card:'card-outline', cash:'cash-outline', wallet:'wallet-outline', other:'file-tray-outline' };
  return m[type] || 'wallet-outline';
}

const styles = StyleSheet.create({
  root:        { flex:1, backgroundColor:Colors.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },

  // Shared Header
  header:      { borderBottomWidth:0 },
  headerDesktop:{ borderBottomWidth:1, borderBottomColor:Colors.outlineVariant+'20', backgroundColor:Colors.surfaceContainerLowest+'80' },
  headerInner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:Spacing.lg, paddingVertical:12 },
  headerTitle: { fontSize:17, fontWeight:'700', color:Colors.primary, letterSpacing:-0.3 },

  contentOuter: { flex: 1 },
  contentOuterDesktop: { alignItems: 'center' },
  contentInner: { flex: 1, width: '100%' },

  sectionTitle:{ fontSize:10, color:Colors.onSurfaceVariant, letterSpacing:3, fontWeight:'700', marginLeft:Spacing.lg, marginBottom:Spacing.md, marginTop:Spacing.md },
  list:        { paddingHorizontal:Spacing.lg, paddingBottom:Spacing.xxl, gap:Spacing.md },

  // Cards
  center:      { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  emptyText:   { color:Colors.onSurfaceVariant, fontSize:15 },
  emptyBtn:    { paddingHorizontal:20, paddingVertical:10, borderRadius:Radius.full, backgroundColor:Colors.primaryContainer+'33' },
  emptyBtnText:{ color:Colors.primary, fontWeight:'600' },
  card:        { backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.lg, padding:Spacing.lg, gap:Spacing.lg },
  cardGradient:{ backgroundColor:Colors.primaryContainer, shadowColor:Colors.primaryContainer, shadowOffset:{width:0,height:10}, shadowOpacity:0.25, shadowRadius:24, elevation:10 },
  cardHeader:  { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  cardTypeLabel:{ fontSize:10, color:Colors.onSurfaceVariant, fontWeight:'700', letterSpacing:1.5, marginBottom:2 },
  cardName:    { fontSize:22, fontWeight:'800', color:Colors.onSurface, letterSpacing:-0.5 },
  cardFooter:  { gap:4 },
  cardBal:     { fontSize:28, fontWeight:'800', color:Colors.onSurface, letterSpacing:-1 },
  cardBalEmpty:{ fontSize:18, fontWeight:'700', color:Colors.onSurfaceVariant },
  pillRow:     { flexDirection:'row', gap:8, marginTop:4 },
  pill:        { paddingHorizontal:10, paddingVertical:4, borderRadius:Radius.full, backgroundColor:Colors.surfaceContainerHighest },
  pillText:    { fontSize:10, fontWeight:'700', color:Colors.onSurfaceVariant, letterSpacing:1, textTransform:'uppercase' },

  // Modal
  modalBg:     { flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', alignItems:'center', padding:20 },
  modalContentWrap: { width:'100%', maxWidth:520 },
  modalCard:   { backgroundColor:Colors.surfaceContainerLow, borderRadius:Radius.lg, padding:Spacing.xl, gap:Spacing.md },
  modalCardDesktop:{ borderRadius:Radius.lg },
  modalHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:Spacing.sm },
  modalTitle:  { fontSize:20, fontWeight:'800', color:Colors.onSurface, letterSpacing:-0.5 },
  input:       { backgroundColor:Colors.surfaceContainerLowest, height:52, borderRadius:Radius.md, paddingHorizontal:16, fontSize:15, color:Colors.onSurface },
  typeGrid:    { flexDirection:'row', flexWrap:'wrap', gap:8 },
  typeBtn:     { width:'31%', height:40, backgroundColor:Colors.surfaceContainerHighest, borderRadius:Radius.full, alignItems:'center', justifyContent:'center' },
  typeBtnAct:  { backgroundColor:Colors.primaryContainer },
  typeText:    { fontSize:12, fontWeight:'600', color:Colors.onSurfaceVariant },
  typeTextAct: { color:Colors.onPrimaryContainer },
  chkRow:      { flexDirection:'row', alignItems:'center', gap:10, marginVertical:8 },
  chkText:     { fontSize:14, color:Colors.onSurfaceVariant },
  modalActions:{ flexDirection:'row', gap:12, marginTop:8 },
  btnCancel:   { flex:1, height:50, borderRadius:Radius.full, backgroundColor:Colors.surfaceContainerHigh, alignItems:'center', justifyContent:'center' },
  btnCancelText:{ color:Colors.onSurface, fontWeight:'600' },
  btnSave:     { flex:1, height:50, borderRadius:Radius.full, backgroundColor:Colors.primaryContainer, alignItems:'center', justifyContent:'center' },
  btnSaveText: { color:'#fff', fontWeight:'700' },
});
