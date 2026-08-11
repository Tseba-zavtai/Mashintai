import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, Plus, Phone, Star, X } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { addContactPhone, loadContactPhones, makeDefaultContactPhone, type ContactPhone } from "@/lib/contactPhones";

type Props = {
  visible: boolean;
  userId?: string | null;
  selectedPhone?: string | null;
  onClose: () => void;
  onSelect: (phone: string) => void;
  makeSelectionDefault?: boolean;
  title?: string;
};

export default function ContactPhonePickerModal({
  visible,
  userId,
  selectedPhone,
  onClose,
  onSelect,
  makeSelectionDefault = false,
  title = "Холбоо барих утас",
}: Props) {
  const { colors } = useTheme();
  const [phones, setPhones] = useState<ContactPhone[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [labelInput, setLabelInput] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const nextPhones = await loadContactPhones(userId);
      setPhones(nextPhones);
      setAdding(nextPhones.length === 0);
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Холбоо барих дугааруудыг уншиж чадсангүй.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) void refresh();
    if (!visible) {
      setPhoneInput("");
      setLabelInput("");
      setAdding(false);
    }
  }, [visible, refresh]);

  const selectPhone = async (item: ContactPhone) => {
    try {
      if (makeSelectionDefault && !item.is_default && userId) await makeDefaultContactPhone(userId, item.id);
      onSelect(item.phone);
      onClose();
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Үндсэн дугаарыг шинэчилж чадсангүй.");
    }
  };

  const saveNewPhone = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      const saved = await addContactPhone(userId, phoneInput, labelInput);
      setPhones((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setPhoneInput("");
      setLabelInput("");
      onSelect(saved.phone);
      onClose();
    } catch (error: any) {
      Alert.alert("Алдаа", error?.message || "Дугаарыг хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>Энд хадгалсан дугаарууд profile дээр нийтэд харагдахгүй. Сонгосон дугаар л тухайн зар эсвэл хүсэлтэд ашиглагдана.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={24} color={colors.text} /></TouchableOpacity>
          </View>

          {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {!adding && phones.map((item) => {
                const selected = item.phone === selectedPhone;
                return (
                  <TouchableOpacity key={item.id} style={[styles.phoneRow, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? `${colors.primary}12` : colors.backgroundSecondary }]} onPress={() => void selectPhone(item)} activeOpacity={0.8}>
                    <View style={[styles.phoneIcon, { backgroundColor: `${colors.primary}14` }]}><Phone size={19} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.phoneValue, { color: colors.text }]}>{item.phone}</Text>
                      <Text style={[styles.phoneLabel, { color: colors.textSecondary }]}>{item.label || "Холбоо барих"}{item.is_default ? " · Үндсэн" : ""}</Text>
                    </View>
                    {makeSelectionDefault && item.is_default ? <Star size={18} color={colors.primary} fill={colors.primary} /> : null}
                    {selected ? <Check size={20} color={colors.primary} strokeWidth={3} /> : null}
                  </TouchableOpacity>
                );
              })}

              {adding ? (
                <View style={styles.addForm}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Утасны дугаар</Text>
                  <View style={[styles.phoneInputRow, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                    <Text style={[styles.prefix, { color: colors.textSecondary, borderRightColor: colors.border }]}>+976</Text>
                    <TextInput value={phoneInput} onChangeText={(value) => setPhoneInput(value.replace(/\D/g, "").slice(0, 8))} placeholder="9911 2233" placeholderTextColor={colors.textSecondary} keyboardType="number-pad" maxLength={8} style={[styles.phoneInput, { color: colors.text }]} autoFocus />
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Нэршил (сонголтоор)</Text>
                  <TextInput value={labelInput} onChangeText={setLabelInput} placeholder="Жишээ: Хувийн, Компанийн" placeholderTextColor={colors.textSecondary} style={[styles.labelInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} maxLength={40} />
                  <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={() => void saveNewPhone()} disabled={saving}>
                    {saving ? <ActivityIndicator color={colors.buttonText} /> : <Text style={[styles.saveButtonText, { color: colors.buttonText }]}>Хадгалаад үргэлжлүүлэх</Text>}
                  </TouchableOpacity>
                  {phones.length > 0 ? <TouchableOpacity onPress={() => setAdding(false)} style={styles.cancelButton}><Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Болих</Text></TouchableOpacity> : null}
                </View>
              ) : (
                <TouchableOpacity style={[styles.addButton, { borderColor: colors.border }]} onPress={() => setAdding(true)}><Plus size={19} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "800" }}>Шинэ дугаар нэмэх</Text></TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "82%", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 30 },
  header: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  title: { fontSize: 22, fontWeight: "900", marginBottom: 5 },
  description: { fontSize: 13, lineHeight: 19, paddingRight: 6 },
  loading: { height: 160, justifyContent: "center", alignItems: "center" },
  phoneRow: { minHeight: 74, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  phoneIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  phoneValue: { fontSize: 16, fontWeight: "800" },
  phoneLabel: { fontSize: 12, marginTop: 3 },
  addButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 4 },
  addForm: { paddingTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "800", marginBottom: 7, marginTop: 10 },
  phoneInputRow: { height: 54, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center" },
  prefix: { width: 76, textAlign: "center", fontSize: 16, fontWeight: "700", borderRightWidth: 1, paddingVertical: 14 },
  phoneInput: { flex: 1, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  labelInput: { height: 52, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 15 },
  saveButton: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 18 },
  saveButtonText: { fontSize: 15, fontWeight: "900" },
  cancelButton: { alignItems: "center", paddingVertical: 15 },
});
