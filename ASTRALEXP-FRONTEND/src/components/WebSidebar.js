import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

const NAV_ITEMS = [
  { route: 'ChatTab',     label: 'Chat',     icon: 'chatbubble',  iconOut: 'chatbubble-outline'  },
  { route: 'ExpensesTab', label: 'Expenses', icon: 'receipt',     iconOut: 'receipt-outline'     },
  { route: 'PaymentsTab', label: 'Vaults',   icon: 'wallet',      iconOut: 'wallet-outline'      },
  { route: 'ProfileTab',  label: 'Profile',  icon: 'person',      iconOut: 'person-outline'      },
];

/**
 * WebSidebar — renders as the Tab.Navigator's `tabBar` on desktop/tablet.
 *
 * Positioned ABSOLUTELY on the left. The Tab.Navigator's `sceneContainerStyle`
 * adds `marginLeft: sidebarWidth` so the scene sits to the right — no overlap,
 * no double rendering of screens.
 *
 * Props:
 *   activeRoute   — currently active tab route name
 *   onNavigate    — callback(routeName) to switch tabs
 *   sidebarWidth  — width in px (240 desktop, 72 tablet collapsed)
 */
export default function WebSidebar({ activeRoute, onNavigate, sidebarWidth = 240 }) {
  const collapsed = sidebarWidth <= 72;

  return (
    <View style={[
      styles.sidebar,
      { width: sidebarWidth },
      // Position absolutely so it doesn't push the scene — scene is already
      // offset via sceneContainerStyle marginLeft in the navigator
      Platform.OS === 'web'
        ? { position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100 }
        : { position: 'absolute', top: 0, left: 0, bottom: 0, zIndex: 100 },
    ]}>
      {/* Brand */}
      <View style={[styles.brand, collapsed && styles.brandCollapsed]}>
        <View style={styles.brandIcon}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={{ width: 28, height: 28, borderRadius: 6 }} 
            resizeMode="contain"
          />
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName} numberOfLines={1}>AstralExp</Text>
            <Text style={styles.brandTagline}>DIGITAL PRIVATE VAULT</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Nav items */}
      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.navItem,
                isActive && styles.navItemActive,
                collapsed && styles.navItemCollapsed,
              ]}
              onPress={() => onNavigate(item.route)}
              activeOpacity={0.75}
            >
              {isActive && <View style={styles.activeBar} />}
              <Ionicons
                name={isActive ? item.icon : item.iconOut}
                size={22}
                color={isActive ? Colors.primary : Colors.onSurfaceVariant}
              />
              {!collapsed && (
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.sidebarFooter}>
        <View style={styles.divider} />
        {!collapsed && (
          <Text style={styles.footerNote}>Financial Fluidity</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRightWidth: 1,
    borderRightColor: Colors.outlineVariant + '40',
    flexDirection: 'column',
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  brandCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    width: '100%',
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    flexShrink: 0,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.onSurface,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 8,
    color: Colors.onSurfaceVariant,
    letterSpacing: 2.5,
    fontWeight: '700',
    marginTop: 2,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.outlineVariant + '30',
    marginHorizontal: 12,
    marginVertical: 4,
  },

  navList: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 2,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    width: 48,
    alignSelf: 'center',
  },
  navItemActive: {
    backgroundColor: Colors.primaryContainer + '22',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: '15%',
    bottom: '15%',
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },

  navLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  sidebarFooter: {
    paddingBottom: 20,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 9,
    color: Colors.outlineVariant,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 12,
    paddingBottom: 4,
  },
});
