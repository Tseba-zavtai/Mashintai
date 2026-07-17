import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Өнгө сонгох</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
              accessibilityLabel="Хаах"
            >
              <X size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.themeGrid}>
            {themeOptions.map((option) => {
              const isSelected = currentTheme === option.type;

              return (
                <TouchableOpacity
                  key={option.type}
                  style={styles.themeButton}
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
                      <View style={[styles.selectionMark, { backgroundColor: colors.card }]}>
                        <Check size={17} color={option.color} strokeWidth={3} />
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", letterSpacing: -0.2 },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 },
  themeButton: { width: "29.5%", aspectRatio: 1, padding: 3 },
  swatch: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  selectedSwatch: { borderWidth: 3 },
  selectionMark: {
    position: "absolute",
    right: -7,
    bottom: -7,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
});