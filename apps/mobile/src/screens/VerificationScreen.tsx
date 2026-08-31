import React, {useState} from 'react';
import {Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {FileImage, ShieldCheck} from '../components/AliIcon';
import {launchImageLibrary, type Asset} from 'react-native-image-picker';
import {useQuery} from '@tanstack/react-query';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import {PrimaryButton} from '../components/PrimaryButton';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

export function VerificationScreen() {
  const theme = useAppTheme();
  const {account, refresh} = useAuth();
  const status = useQuery({queryKey: ['verification'], queryFn: api.myVerification});
  const [realName, setRealName] = useState(account?.real_name ?? '');
  const [studentNo, setStudentNo] = useState(account?.student_no ?? '');
  const [material, setMaterial] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  if (status.isLoading) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState loading /></SafeAreaView>;
  const verification = status.data?.verification;
  const submit = async () => {
    if (!material?.uri) return;
    setLoading(true); setMessage('');
    try {
      const uploaded = await api.upload({uri: material.uri, name: material.fileName ?? 'verification.jpg', type: material.type ?? 'image/jpeg'});
      await api.submitVerification({material_url: uploaded.url, real_name: realName.trim(), student_no: studentNo.trim()});
      setMessage('认证材料已提交，请等待管理员人工审核。');
      await Promise.all([status.refetch(), refresh()]);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : '提交失败'); }
    finally { setLoading(false); }
  };
  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {verification ? <View style={[styles.status, {backgroundColor: theme.colors.primarySoft}]}><ShieldCheck size={24} color={theme.colors.primary} /><View style={styles.statusBody}><Text style={[styles.statusTitle, {color: theme.colors.text}]}>{verification.status === 'approved' ? '认证已通过' : verification.status === 'pending' ? '材料审核中' : '认证未通过'}</Text>{verification.reject_reason ? <Text style={[styles.statusText, {color: theme.colors.textSecondary}]}>原因：{verification.reject_reason}</Text> : null}</View></View> : null}
        {verification?.status !== 'approved' ? <>
          <Text style={[styles.label, {color: theme.colors.text}]}>真实姓名</Text><TextInput value={realName} onChangeText={setRealName} style={[styles.input, {color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]} />
          <Text style={[styles.label, {color: theme.colors.text}]}>学号</Text><TextInput value={studentNo} onChangeText={setStudentNo} keyboardType="number-pad" style={[styles.input, {color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]} />
          <Text style={[styles.label, {color: theme.colors.text}]}>证明材料（1 张）</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="选择认证图片" onPress={() => launchImageLibrary({mediaType: 'photo', selectionLimit: 1, quality: 0.8}).then(result => result.assets?.[0] && setMaterial(result.assets[0]))} style={({pressed}) => [styles.picker, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1}]}>{material?.uri ? <Image source={{uri: material.uri}} style={styles.material} /> : <><FileImage size={34} color={theme.colors.primary} /><Text style={[styles.pickerTitle, {color: theme.colors.text}]}>选择学生证或学信网截图</Text><Text style={[styles.pickerText, {color: theme.colors.textSecondary}]}>需清楚显示姓名、学号和学校信息，可遮挡无关敏感信息</Text></>}</Pressable>
          {message ? <Text accessibilityRole="alert" style={[styles.message, {color: message.includes('已提交') ? theme.colors.success : theme.colors.danger}]}>{message}</Text> : null}
          <PrimaryButton label="提交人工审核" loading={loading} disabled={!realName.trim() || !studentNo.trim() || !material} onPress={() => void submit()} style={styles.submit} />
        </> : <Text style={[styles.approvedText, {color: theme.colors.textSecondary}]}>你的学生身份已经核验，可以使用发帖、评论、私信与 AI 问答等完整功能。</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1}, content: {padding: spacing.md, paddingBottom: 40},
  status: {borderRadius: radius.md, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 24}, statusBody: {flex: 1, marginLeft: 12}, statusTitle: {fontSize: 16, fontWeight: '900'}, statusText: {fontSize: 12, lineHeight: 18, marginTop: 4},
  label: {fontSize: 13, fontWeight: '800', marginBottom: 8}, input: {minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, fontSize: 16, marginBottom: 18},
  picker: {minHeight: 210, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: 20}, material: {width: '100%', height: 200, borderRadius: radius.sm}, pickerTitle: {fontSize: 15, fontWeight: '800', marginTop: 12}, pickerText: {fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6},
  message: {fontSize: 13, lineHeight: 20, marginTop: 14}, submit: {marginTop: 18}, approvedText: {fontSize: 15, lineHeight: 24, textAlign: 'center', paddingTop: 36},
});
