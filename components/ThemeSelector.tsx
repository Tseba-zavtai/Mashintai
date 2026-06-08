import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { X, Check } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeType, themes } from "@/constants/colors";

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

export default function ThemeSelector({ visible, onClose }: ThemeSelectorProps) {
  const { currentTheme, changeTheme, colors } = useTheme();

  const handleSelectTheme = async (theme: ThemeType) => {
    await changeTheme(theme);
    setTimeout(() => {
      onClose();
    }, 200);
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
              const themeColors = themes[option.type] ?? themes.purple;

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
                          backgroundColor: themeColors.primary,
                          borderColor: themeColors.border,
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
                      <Check size={18} color="#FFFFFF" strokeWidth={3} />
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  closeButton: {
    padding: 4,
  },
  themeList: {
    gap: 12,
  },
  themeItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  themeItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  colorPreview: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    borderWidth: 1,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  themeDescription: {
    fontSize: 13,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});