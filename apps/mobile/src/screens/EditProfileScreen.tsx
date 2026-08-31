import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, Check } from '../components/AliIcon';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
import { PrimaryButton } from '../components/PrimaryButton';
import { radius, spacing, useAppTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const { account, refresh } = useAuth();
  const [nickname, setNickname] = useState(account?.nickname ?? '');
  const [gender, setGender] = useState(account?.gender || '男');
  const [className, setClassName] = useState(account?.class_name ?? '');
  const [realName, setRealName] = useState(account?.real_name ?? '');
  const [studentNo, setStudentNo] = useState(account?.student_no ?? '');
  const [avatar, setAvatar] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const allowExit = useRef(false);
  const dirty = useMemo(
    () =>
      Boolean(
        avatar ||
          nickname !== (account?.nickname ?? '') ||
          gender !== (account?.gender || '男') ||
          className !== (account?.class_name ?? '') ||
          realName !== (account?.real_name ?? '') ||
          studentNo !== (account?.student_no ?? ''),
      ),
    [account, avatar, className, gender, nickname, realName, studentNo],
  );

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (!dirty || allowExit.current) return;
        event.preventDefault();
        Alert.alert('放弃未保存的修改？', '返回后本页修改将不会保留。', [
          { text: '继续编辑', style: 'cancel' },
          {
            text: '放弃修改',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [dirty, navigation],
  );

  if (!account) return null;

  const chooseAvatar = async () => {
    setError('');
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.8,
    });
    if (result.errorMessage) {
      setError(`无法读取图片：${result.errorMessage}`);
      return;
    }
    if (result.assets?.[0]) setAvatar(result.assets[0]);
  };
  const save = async () => {
    setLoading(true);
    setError('');
    try {
      let avatarUrl = account.avatar;
      if (avatar?.uri) {
        const uploaded = await api.upload({
          uri: avatar.uri,
          name: avatar.fileName ?? 'avatar.jpg',
          type: avatar.type ?? 'image/jpeg',
        });
        avatarUrl = uploaded.url;
      }
      await api.updateProfile({
        nickname: nickname.trim(),
        avatar: avatarUrl,
        gender,
        class_name: className.trim(),
        real_name: account.verified ? account.real_name ?? '' : realName.trim(),
        student_no: account.verified
          ? account.student_no ?? ''
          : studentNo.trim(),
      });
      await refresh();
      allowExit.current = true;
      navigation.goBack();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '资料保存失败');
    } finally {
      setLoading(false);
    }
  };

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
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="更换头像"
            accessibilityHint="从相册选择一张图片"
            onPress={() => void chooseAvatar()}
            style={styles.avatarButton}
            pressedStyle={styles.pressed}
          >
            {avatar?.uri ? (
              <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
            ) : (
              <Avatar uri={account.avatar} name={account.nickname} size={86} />
            )}
            <View
              style={[styles.camera, { backgroundColor: theme.colors.primary }]}
            >
              <Camera size={18} color="#FFFFFF" />
            </View>
          </PressableScale>
          <Field label="昵称" helper={`${nickname.trim().length}/16`}>
            <TextInput
              accessibilityLabel="昵称"
              value={nickname}
              onChangeText={setNickname}
              maxLength={16}
              autoCorrect={false}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            />
          </Field>
          <Field label="性别">
            <View style={styles.genderRow}>
              {['男', '女'].map(value => (
                <PressableScale
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={value}
                  accessibilityState={{ checked: gender === value }}
                  onPress={() => setGender(value)}
                  style={[
                    styles.gender,
                    {
                      backgroundColor:
                        gender === value
                          ? theme.colors.primarySoft
                          : theme.colors.surface,
                      borderColor:
                        gender === value
                          ? theme.colors.primary
                          : theme.colors.border,
                    },
                  ]}
                  pressedStyle={styles.pressed}
                >
                  <Text
                    style={{
                      color:
                        gender === value
                          ? theme.colors.primary
                          : theme.colors.text,
                      fontWeight: '700',
                    }}
                  >
                    {value}
                  </Text>
                  {gender === value ? (
                    <Check size={16} color={theme.colors.primary} />
                  ) : null}
                </PressableScale>
              ))}
            </View>
          </Field>
          <Field label="班级">
            <TextInput
              accessibilityLabel="班级"
              value={className}
              onChangeText={setClassName}
              placeholder="例如：计算机 2401"
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            />
          </Field>
          {!account.verified ? (
            <>
              <Field
                label="真实姓名"
                helper="仅用于校内身份核验，不会公开展示。"
              >
                <TextInput
                  accessibilityLabel="真实姓名"
                  value={realName}
                  onChangeText={setRealName}
                  placeholder="请填写真实姓名"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                />
              </Field>
              <Field
                label="学号"
                helper="认证通过后将锁定，如需修改请联系运营人员。"
              >
                <TextInput
                  accessibilityLabel="学号"
                  value={studentNo}
                  onChangeText={setStudentNo}
                  keyboardType="number-pad"
                  placeholder="请输入学号"
                  placeholderTextColor={theme.colors.textSecondary}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                />
              </Field>
            </>
          ) : (
            <Text
              style={[styles.locked, { color: theme.colors.textSecondary }]}
            >
              真实姓名与学号已通过认证并受到保护，如需变更请联系运营人员。
            </Text>
          )}
          {error ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: theme.colors.danger }]}
            >
              {error}
            </Text>
          ) : null}
          <PrimaryButton
            label={dirty ? '保存资料' : '资料已是最新'}
            loading={loading}
            disabled={
              !dirty ||
              nickname.trim().length < 2 ||
              !className.trim() ||
              (!account.verified && (!realName.trim() || !studentNo.trim()))
            }
            onPress={() => void save()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  helper,
  children,
}: React.PropsWithChildren<{ label: string; helper?: string }>) {
  const theme = useAppTheme();
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeading}>
        <Text style={[styles.label, { color: theme.colors.text }]}>
          {label}
        </Text>
        {helper ? (
          <Text style={[styles.helper, { color: theme.colors.textSecondary }]}>
            {helper}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  avatarButton: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarImage: { width: 86, height: 86, borderRadius: 43 },
  camera: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  field: { marginBottom: 18 },
  fieldHeading: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8 },
  helper: { flexShrink: 1, fontSize: 11, lineHeight: 17, textAlign: 'right' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  genderRow: { flexDirection: 'row', gap: 10 },
  gender: {
    flex: 1,
    minHeight: 50,
    borderWidth: 1,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  locked: { fontSize: 12, lineHeight: 19, marginBottom: 18 },
  error: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
});
