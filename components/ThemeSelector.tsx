import { Modal, StyleSheet, Text, TouchableOpacity, View, InteractionManager } from "react-native";
import { X, Check } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeType } from "@/constants/colors";

interface ThemeSelectorProps {
  visible: boolean;
  onClose: () => void;
}

const themeOptions: { type: ThemeType; name: string; description: string }[] = [
  { type: "purple", name: "Purple", description: "Нил ягаан өнгө" },
  { type: "peach", name: "Peach", description: "Тоорын зөөлөн өнгө" },
  { type: "sky", name: "Sky", description: "Тэнгэрийн цэнхэр өнгө" },
  { type: "navy", name: "Navy", description: "Бараан хөх өнгө" },
  { type: "gray", name: "Gray", description: "Саарал өнгө" },
  { type: "mint", name: "Mint", description: "Минт ногоон өнгө" },
];

const PREVIEW_BACKGROUNDS: Record<ThemeType, string> = {
  purple: "#6E0AB0",
  peach: "#FFE3DD",
  navy: "#201A2E",
  gray: "#D0D2D8",
  mint: "#8FE3CF",
  sky: "#AFC6D9"
};

export default function ThemeSelector({ visible, onClose }: ThemeSelectorProps) {
  const { currentTheme, changeTheme, colors } = useTheme();

  const handleSelectTheme = (theme: ThemeType) => {
    changeTheme(theme);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        onClose();
      }, 250); 
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onClose}
          accessible={false}
        />

        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Theme сонгох</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.themeList}>
            {themeOptions.map((option) => {
              const isSelected = currentTheme === option.type;
              const previewBg = PREVIEW_BACKGROUNDS[option.type] || "#6E0AB0";

              return (
                <TouchableOpacity
                  key={option.type}
                  style={[
                    styles.themeItem,
                    {
                      backgroundColor: colors.backgroundSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                  onPress={() => handleSelectTheme(option.type)}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeItemContent}>
                    <View
                      style={[
                        styles.colorPreview,
                        {
                          backgroundColor: previewBg,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <View style={styles.themeInfo}>
                      <Text style={[styles.themeName, { color: colors.text }]}>
                        {option.name}
                      </Text>
                      <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
                        {option.description}
                      </Text>
                    </View>
                  </View>

                  {isSelected && (
                    <View style={[styles.checkIcon, { backgroundColor: colors.primary }]}>
                      <Check size={18} color={colors.headerText} strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  closeButton: { padding: 4 },
  themeList: { gap: 12 },
  themeItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16 },
  themeItemContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  colorPreview: { width: 44, height: 44, borderRadius: 22, marginRight: 16, borderWidth: 1 },
  themeInfo: { flex: 1 },
  themeName: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  themeDescription: { fontSize: 12 },
  checkIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});