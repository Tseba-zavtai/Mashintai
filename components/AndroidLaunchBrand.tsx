import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

/** Android's OS splash masks wide logos. Show the full wordmark in app space. */
export default function AndroidLaunchBrand() {
  const [visible, setVisible] = useState(Platform.OS === 'android');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const timer = setTimeout(() => setVisible(false), 700);
    return () => clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <View style={styles.cover} accessibilityLabel="Tureesly">
      <Image source={require('@/assets/logos/Logo-dark.png')} style={styles.logo} resizeMode="contain" />
    </View>
  );
}
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFE3DD', alignItems: 'center', justifyContent: 'center', zIndex: 10000, elevation: 10000 },
  logo: { width: '70%', maxWidth: 300, aspectRatio: 4 },
});
