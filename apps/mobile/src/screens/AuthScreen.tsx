import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Eye, EyeOff, LockKeyhole, Phone, ShieldCheck} from '../components/AliIcon';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {PrimaryButton} from '../components/PrimaryButton';
import {radius, spacing, useAppTheme} from '../theme';

export function AuthScreen() {
  const theme = useAppTheme();
  const {login, register} = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('13800000000');
  const [password, setPassword] = useState('Demo12345');
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState('xsnbb-test');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [helper, setHelper] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(phone.trim(), password);
      } else {
        await register({phone: phone.trim(), password, nickname: nickname.trim(), code: code.trim(), invite_code: invite.trim()});
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '暂时无法登录，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    setSending(true);
    setError('');
    try {
      const result = await api.smsCode(phone.trim());
      setHelper(result.dev_code ? `开发环境验证码：${result.dev_code}` : '验证码已发送，5 分钟内有效');
      if (result.dev_code) {
        setCode(result.dev_code);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const valid = /^1\d{10}$/.test(phone.trim()) && password.length >= 8 && (mode === 'login' || (code.trim().length > 0 && invite.trim().length > 0));

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.brandMark, {backgroundColor: theme.colors.primary}]} accessibilityLabel="xsnbb">
            <Text style={styles.brandLetter}>x</Text>
          </View>
          <Text style={[styles.brand, {color: theme.colors.text}]}>xsnbb</Text>
          <Text style={[styles.tagline, {color: theme.colors.textSecondary}]}>只属于同学们的校园社区</Text>

          <View style={[styles.form, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
            <View style={[styles.switcher, {backgroundColor: theme.colors.surfaceMuted}]}>
              {(['login', 'register'] as const).map(item => (
                <Pressable
                  key={item}
                  accessibilityRole="tab"
                  accessibilityState={{selected: mode === item}}
                  onPress={() => { setMode(item); setError(''); setHelper(''); }}
                  style={[styles.modeButton, mode === item && {backgroundColor: theme.colors.surface}]}>
                  <Text style={[styles.modeText, {color: mode === item ? theme.colors.text : theme.colors.textSecondary}]}>
                    {item === 'login' ? '登录' : '注册'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Field label="手机号" icon={Phone}>
              <TextInput
                accessibilityLabel="手机号"
                value={phone}
                onChangeText={setPhone}
                placeholder="请输入 11 位手机号"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={11}
                style={[styles.input, {color: theme.colors.text}]}
              />
            </Field>

            {mode === 'register' ? (
              <>
                <Field label="昵称（可稍后完善）" icon={ShieldCheck}>
                  <TextInput
                    accessibilityLabel="昵称"
                    value={nickname}
                    onChangeText={setNickname}
                    placeholder="2–16 个字符"
                    placeholderTextColor={theme.colors.textSecondary}
                    maxLength={16}
                    style={[styles.input, {color: theme.colors.text}]}
                  />
                </Field>
                <Text style={[styles.label, {color: theme.colors.text}]}>短信验证码</Text>
                <View style={styles.codeLine}>
                  <TextInput
                    accessibilityLabel="短信验证码"
                    value={code}
                    onChangeText={setCode}
                    placeholder="请输入验证码"
                    placeholderTextColor={theme.colors.textSecondary}
                    keyboardType="number-pad"
                    style={[styles.codeInput, {color: theme.colors.text, borderColor: theme.colors.border}]}
                  />
                  <PrimaryButton label={sending ? '发送中' : '获取验证码'} loading={sending} disabled={!/^1\d{10}$/.test(phone.trim())} onPress={sendCode} variant="secondary" style={styles.codeButton} />
                </View>
              </>
            ) : null}

            <Field label="密码" icon={LockKeyhole} action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? '隐藏密码' : '显示密码'}
                hitSlop={10}
                onPress={() => setShowPassword(value => !value)}
                style={styles.eyeButton}>
                {showPassword ? <EyeOff size={21} color={theme.colors.textSecondary} /> : <Eye size={21} color={theme.colors.textSecondary} />}
              </Pressable>
            }>
              <TextInput
                accessibilityLabel="密码"
                value={password}
                onChangeText={setPassword}
                placeholder="至少 8 位"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showPassword}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={[styles.input, {color: theme.colors.text}]}
              />
            </Field>

            {mode === 'register' ? (
              <Field label="邀请码" icon={ShieldCheck}>
                <TextInput
                  accessibilityLabel="邀请码"
                  value={invite}
                  onChangeText={setInvite}
                  placeholder="请输入邀请码"
                  placeholderTextColor={theme.colors.textSecondary}
                  autoCapitalize="none"
                  style={[styles.input, {color: theme.colors.text}]}
                />
              </Field>
            ) : null}

            {helper ? <Text style={[styles.helper, {color: theme.colors.success}]}>{helper}</Text> : null}
            {error ? <Text accessibilityRole="alert" style={[styles.error, {color: theme.colors.danger}]}>{error}</Text> : null}
            <PrimaryButton label={mode === 'login' ? '进入校园社区' : '注册并登录'} loading={loading} disabled={!valid} onPress={submit} style={styles.submit} />
            {mode === 'login' ? <Text style={[styles.demo, {color: theme.colors.textSecondary}]}>已预填内测账号，可直接体验</Text> : null}
          </View>

          <Text style={[styles.disclaimer, {color: theme.colors.textSecondary}]}>本社区由学生独立运营，不代表学校官方。</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({label, icon: Icon, action, children}: React.PropsWithChildren<{label: string; icon: typeof Phone; action?: React.ReactNode}>) {
  const theme = useAppTheme();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, {color: theme.colors.text}]}>{label}</Text>
      <View style={[styles.field, {borderColor: theme.colors.border, backgroundColor: theme.colors.background}]}>
        <Icon size={20} color={theme.colors.textSecondary} />
        {children}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  safe: {flex: 1},
  content: {flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: 42, paddingBottom: spacing.xl, alignItems: 'center'},
  brandMark: {width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center'},
  brandLetter: {color: '#FFFFFF', fontSize: 38, lineHeight: 45, fontWeight: '900'},
  brand: {fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: 12, letterSpacing: -1},
  tagline: {fontSize: 15, marginTop: 4},
  form: {width: '100%', maxWidth: 520, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.xl},
  switcher: {height: 44, borderRadius: 13, flexDirection: 'row', padding: 3, marginBottom: spacing.lg},
  modeButton: {flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  modeText: {fontSize: 15, fontWeight: '700'},
  fieldGroup: {marginBottom: 16},
  label: {fontSize: 13, fontWeight: '700', marginBottom: 7},
  field: {minHeight: 50, borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14},
  input: {flex: 1, minHeight: 48, fontSize: 16, paddingVertical: 0},
  eyeButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10},
  codeLine: {flexDirection: 'row', gap: 10, marginBottom: 16},
  codeInput: {flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, fontSize: 16},
  codeButton: {width: 132},
  helper: {fontSize: 13, lineHeight: 19, marginBottom: 10},
  error: {fontSize: 13, lineHeight: 19, marginBottom: 10},
  submit: {marginTop: 2},
  demo: {fontSize: 12, textAlign: 'center', marginTop: 12},
  disclaimer: {fontSize: 12, lineHeight: 18, marginTop: 24, textAlign: 'center'},
});
