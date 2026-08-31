import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from '../components/AliIcon';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { radius, spacing, useAppTheme } from '../theme';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

export function AccountSettingsScreen() {
  const theme = useAppTheme();
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const mismatch = confirm.length > 0 && next !== confirm;

  const change = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setFeedback({ kind: 'success', text: '密码已更新，请妥善保管新密码。' });
    } catch (reason) {
      setFeedback({
        kind: 'error',
        text:
          reason instanceof Error
            ? reason.message
            : '密码修改失败，请稍后重试。',
      });
    } finally {
      setLoading(false);
    }
  };

  const deactivate = () =>
    Alert.alert(
      '确认注销账号？',
      '注销后内部资料会删除，帖子和评论将匿名化。该操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认注销',
          style: 'destructive',
          onPress: async () => {
            setDeactivating(true);
            setFeedback(null);
            try {
              await api.deleteAccount();
              await logout();
            } catch (reason) {
              setFeedback({
                kind: 'error',
                text:
                  reason instanceof Error
                    ? reason.message
                    : '注销失败，请稍后重试。',
              });
              setDeactivating(false);
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.securityNotice,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <ShieldCheck size={22} color={theme.colors.primary} />
            <Text
              style={[styles.securityNoticeText, { color: theme.colors.text }]}
            >
              密码修改成功后，其他已登录设备会立即退出，当前设备保持登录。
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.cardTitle}>
              <KeyRound size={21} color={theme.colors.primary} />
              <Text style={[styles.title, { color: theme.colors.text }]}>
                修改密码
              </Text>
            </View>
            <PasswordField
              label="当前密码"
              value={current}
              onChange={setCurrent}
              currentPassword
            />
            <PasswordField
              label="新密码"
              value={next}
              onChange={setNext}
              helper="至少 8 位，建议同时包含字母和数字。"
            />
            <PasswordField
              label="确认新密码"
              value={confirm}
              onChange={setConfirm}
              error={mismatch ? '两次输入的新密码不一致。' : undefined}
            />
            {feedback ? (
              <View
                accessibilityRole="alert"
                style={[
                  styles.feedback,
                  {
                    backgroundColor:
                      feedback.kind === 'success'
                        ? theme.colors.primarySoft
                        : theme.colors.surfaceMuted,
                  },
                ]}
              >
                {feedback.kind === 'success' ? (
                  <ShieldCheck size={18} color={theme.colors.success} />
                ) : (
                  <CircleAlert size={18} color={theme.colors.danger} />
                )}
                <Text
                  style={[
                    styles.feedbackText,
                    {
                      color:
                        feedback.kind === 'success'
                          ? theme.colors.success
                          : theme.colors.danger,
                    },
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
            ) : null}
            <PrimaryButton
              label="更新密码"
              loading={loading}
              disabled={
                current.length < 8 ||
                next.length < 8 ||
                next === current ||
                mismatch ||
                confirm.length < 8
              }
              onPress={() => void change()}
            />
          </View>

          <View
            style={[
              styles.dangerCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.cardTitle}>
              <CircleAlert size={21} color={theme.colors.danger} />
              <Text style={[styles.title, { color: theme.colors.text }]}>
                注销账号
              </Text>
            </View>
            <Text
              style={[styles.dangerText, { color: theme.colors.textSecondary }]}
            >
              账号注销不可恢复。学号会释放，公开内容保留但作者将显示为“已注销用户”。
            </Text>
            <PrimaryButton
              label="申请注销账号"
              variant="danger"
              loading={deactivating}
              onPress={deactivate}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  helper,
  error,
  currentPassword = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helper?: string;
  error?: string;
  currentPassword?: boolean;
}) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          {
            borderColor: error ? theme.colors.danger : theme.colors.border,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChange}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={currentPassword ? 'current-password' : 'new-password'}
          textContentType={currentPassword ? 'password' : 'newPassword'}
          style={[styles.input, { color: theme.colors.text }]}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={visible ? `隐藏${label}` : `显示${label}`}
          onPress={() => setVisible(currentVisible => !currentVisible)}
          style={styles.visibilityButton}
          pressedStyle={{ backgroundColor: theme.colors.surfaceMuted }}
          pressedScale={0.94}
        >
          {visible ? (
            <EyeOff size={20} color={theme.colors.textSecondary} />
          ) : (
            <Eye size={20} color={theme.colors.textSecondary} />
          )}
        </PressableScale>
      </View>
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.helper, { color: theme.colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
      {!error && helper ? (
        <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  securityNotice: {
    borderRadius: radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 16,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
  },
  dangerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 18,
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '900' },
  field: { marginBottom: 16 },
  label: { fontSize: 13, lineHeight: 19, fontWeight: '800', marginBottom: 7 },
  inputWrap: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingLeft: 14,
    paddingRight: 4,
    fontSize: 16,
  },
  visibilityButton: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  feedback: {
    borderRadius: radius.sm,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  dangerText: { fontSize: 13, lineHeight: 20, marginBottom: 16 },
});
