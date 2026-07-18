import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeType } from "@/constants/colors";

interface ThemeSelectorProps {
  visible: boolean;
  onClose: () => void;
}

type ThemeOption = {
  type: ThemeType;
  accessibilityLabel: string;
  color: string;
};

const themeOptions: ThemeOption[] = [
  { type: "purple", accessibilityLabel: "Нил ягаан өнгө", color: "#6E0AB0" },
  { type: "peach", accessibilityLabel: "Тоорын өнгө", color: "#FFE3DD" },
  { type: "sky", accessibilityLabel: "Тэнгэрийн цэнхэр өнгө", color: "#AFC6D9" },
  { type: "navy", accessibilityLabel: "Бараан хөх өнгө", color: "#201A2E" },
  { type: "gray", accessibilityLabel: "Саарал өнгө", color: "#D0D2D8" },
  { type: "mint", accessibilityLabel: "Минт ногоон өнгө", color: "#8FE3CF" },
];

export default function ThemeSelector({ visible, onClose }: ThemeSelectorProps) {
  const { currentTheme, changeTheme, colors } = useTheme();
  const { width } = useWindowDimensions();
  const swatchSize = Math.min(48, Math.max(44, Math.floor((width - 62) / 6)));

  const handleSelectTheme = async (theme: ThemeType) => {
    if (theme !== currentTheme) {
      await changeTheme(theme);
    }

    setTimeout(onClose, 180);
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Өнгө</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityLabel="Хаах"
            >
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.themeRow}>
            {themeOptions.map((option) => {
              const isSelected = currentTheme === option.type;

              return (
                <TouchableOpacity
                  key={option.type}
                  style={[styles.themeButton, { width: swatchSize, height: swatchSize }]}
                  onPress={() => handleSelectTheme(option.type)}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={option.accessibilityLabel}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: option.color,
                        borderColor: isSelected ? colors.text : colors.border,
                      },
                      isSelected && styles.selectedSwatch,
                    ]}
                  >
                    {isSelected ? (
                      <View style={[styles.selectionMark, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Check size={13} color={option.color} strokeWidth={3} />
                      </View>
                    ) : null}
                  </View>
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
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  closeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17 },
  themeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  themeButton: { padding: 2 },
  swatch: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedSwatch: { borderWidth: 3 },
  selectionMark: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 2,
  },
});