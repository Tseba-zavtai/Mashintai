// app/feedback.tsx
import React, { useState } from 'react';
import { 

  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar'; // 🎯 НЭМСЭН: Утасны дээд талын цаг, сүлжээний дүрсийг удирдах
import { Send } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import AppHeader from "@/components/AppHeader";

export default function FeedbackScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) {
      Alert.alert('Анхаар', 'Санал хүсэлтээ бичнэ үү.');
      return;
    }
    Alert.alert('Баярлалаа', 'Таны санал хүсэлтийг хүлээж авлаа!', [
      { text: 'ОК', onPress: () => router.back() }
    ]);
  };

  return (
    // 🎯 ЗАССАН: SafeAreaView-ийн өнгийг толгой хэсгийн нил ягаан өнгөтэй ижил болгов
    <SafeAreaView style={[styles.container, { backgroundColor: colors.headerBackground }]} edges={['bottom']}>
      {/* 🎯 НЭМСЭН: Цаг сүлжээний дүрсийг цагаан (light) болгох тохиргоо */}
      <StatusBar style="light" backgroundColor={colors.headerBackground} />
      
      {/* Толгой хэсэг */}
      <AppHeader title="Санал хүсэлт" />

      {/* 🎯 ЗАССАН: Дэвсгэр өнгө доошоо цагаан/саарал хэвээрээ үлдэх зохицуулалт */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView style={[styles.content, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.label, { color: colors.text }]}>
            Апп-ыг сайжруулах санал, илэрсэн алдаа зэргийг бидэнд илгээнэ үү.
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
            placeholder="Энд бичнэ үү..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={text}
            onChangeText={setText}
          />
          
          <TouchableOpacity 
            style={[styles.sendBtn, { backgroundColor: colors.primary }]} 
            onPress={handleSend} 
            activeOpacity={0.8}
          >
            <Send size={20} color={colors.headerText} />
            <Text style={[styles.sendBtnText, { color: colors.headerText }]}>Илгээх</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, padding: 20 },
  label: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  input: { height: 160, borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 15, textAlignVertical: 'top', marginBottom: 24 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8 },
  sendBtnText: { fontSize: 16, fontWeight: '700' },
});