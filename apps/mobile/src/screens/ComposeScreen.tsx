import React, {useState} from 'react';
import {Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {ImagePlus, LockKeyhole, Send, X} from '../components/AliIcon';
import {launchImageLibrary, type Asset} from 'react-native-image-picker';
import {useQueryClient} from '@tanstack/react-query';
import type {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api} from '../api/client';
import {useAuth} from '../auth/AuthContext';
import type {MainTabParamList} from '../navigation/types';
import {PrimaryButton} from '../components/PrimaryButton';
import {radius, spacing, useAppTheme} from '../theme';

export function ComposeScreen() {
  const theme = useAppTheme();
  const {account} = useAuth();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [tagText, setTagText] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canPost = account?.profile_done && account.verified;
  const tags = tagText.split(/[,，]/).map(value => value.trim().replace(/^#/, '')).filter(Boolean).slice(0, 3);

  const pickImages = async () => {
    const available = 9 - assets.length;
    if (available <= 0) return;
    const result = await launchImageLibrary({mediaType: 'photo', selectionLimit: available, quality: 0.8, includeExtra: false});
    if (!result.didCancel && result.assets) {
      setAssets(current => [...current, ...result.assets!].slice(0, 9));
    }
  };

  const submit = async () => {
    const body = text.trim();
    if (!body) {
      setError('请先写点内容再发布');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const uploaded: string[] = [];
      for (const [index, asset] of assets.entries()) {
        if (!asset.uri) continue;
        const result = await api.upload({uri: asset.uri, name: asset.fileName ?? `photo-${index + 1}.jpg`, type: asset.type ?? 'image/jpeg'});
        uploaded.push(result.url);
      }
      const result = await api.createPost({text: body, images: uploaded, tags});
      setSuccess(result.message || '帖子已提交');
      setText('');
      setTagText('');
      setAssets([]);
      await queryClient.invalidateQueries({queryKey: ['posts']});
      setTimeout(() => navigation.navigate('Home'), 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '发布失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!canPost) {
    return (
      <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top']}>
        <View style={styles.locked}>
          <View style={[styles.lockIcon, {backgroundColor: theme.colors.primarySoft}]}><LockKeyhole size={30} color={theme.colors.primary} /></View>
          <Text style={[styles.lockTitle, {color: theme.colors.text}]}>完成认证后即可发布</Text>
          <Text style={[styles.lockText, {color: theme.colors.textSecondary}]}>为了保持真实的校内交流环境，请先完善个人资料并提交学生身份认证。</Text>
          <PrimaryButton label="前往个人页" onPress={() => navigation.navigate('Profile')} style={styles.lockButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={12}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.eyebrow, {color: theme.colors.primary}]}>NEW POST</Text>
          <Text style={[styles.title, {color: theme.colors.text}]}>发布校园动态</Text>
          <Text style={[styles.subtitle, {color: theme.colors.textSecondary}]}>真实、友善、有用，是最受欢迎的分享。</Text>

          <View style={[styles.editor, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
            <TextInput
              accessibilityLabel="帖子正文"
              accessibilityHint="最多输入 2000 个字"
              value={text}
              onChangeText={setText}
              multiline
              maxLength={2000}
              textAlignVertical="top"
              placeholder="此刻想和同学们分享什么？"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.textArea, {color: theme.colors.text}]}
            />
            <Text style={[styles.counter, {color: text.length > 1900 ? theme.colors.danger : theme.colors.textSecondary}]}>{text.length}/2000</Text>
          </View>

          <Text style={[styles.label, {color: theme.colors.text}]}>图片（可选，最多 9 张）</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="选择图片"
              onPress={() => void pickImages()}
              style={({pressed}) => [styles.addImage, {borderColor: theme.colors.border, backgroundColor: theme.colors.surface, opacity: pressed ? 0.72 : 1}]}>
              <ImagePlus size={25} color={theme.colors.primary} />
              <Text style={[styles.addImageText, {color: theme.colors.textSecondary}]}>{assets.length}/9</Text>
            </Pressable>
            {assets.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={styles.previewWrap}>
                <Image source={{uri: asset.uri}} style={styles.preview} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除图片 ${index + 1}`}
                  onPress={() => setAssets(current => current.filter((_, itemIndex) => itemIndex !== index))}
                  style={styles.removeImage}>
                  <X size={15} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <Text style={[styles.label, {color: theme.colors.text}]}>标签（可选，最多 3 个）</Text>
          <TextInput
            accessibilityLabel="帖子标签"
            accessibilityHint="多个标签请用逗号分隔"
            value={tagText}
            onChangeText={setTagText}
            maxLength={36}
            placeholder="例如：校园生活，求助，失物招领"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.tagInput, {color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}
          />
          {tags.length ? <View style={styles.tags}>{tags.map(tag => <Text key={tag} style={[styles.tag, {color: theme.colors.primary, backgroundColor: theme.colors.primarySoft}]}># {tag}</Text>)}</View> : null}

          {error ? <Text accessibilityRole="alert" style={[styles.message, {color: theme.colors.danger}]}>{error}</Text> : null}
          {success ? <Text accessibilityRole="alert" style={[styles.message, {color: theme.colors.success}]}>{success}</Text> : null}
          <PrimaryButton
            label={assets.length ? `上传并发布（${assets.length} 张图片）` : '发布动态'}
            loading={loading}
            disabled={!text.trim()}
            onPress={() => void submit()}
            style={styles.submit}
          />
          <View style={styles.reviewTip}><Send size={16} color={theme.colors.textSecondary} /><Text style={[styles.reviewText, {color: theme.colors.textSecondary}]}>内容通过自动检查后公开，风险内容将进入人工复核。</Text></View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  flex: {flex: 1},
  content: {paddingHorizontal: spacing.md, paddingTop: 24, paddingBottom: 130},
  eyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 1.25},
  title: {fontSize: 28, lineHeight: 36, fontWeight: '900', marginTop: 7},
  subtitle: {fontSize: 15, lineHeight: 22, marginTop: 4, marginBottom: 22},
  editor: {borderWidth: 1, borderRadius: radius.md, minHeight: 220, overflow: 'hidden'},
  textArea: {minHeight: 180, padding: 16, fontSize: 17, lineHeight: 26},
  counter: {fontSize: 12, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 12},
  label: {fontSize: 14, fontWeight: '800', marginTop: 22, marginBottom: 10},
  images: {gap: 10},
  addImage: {width: 92, height: 92, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center'},
  addImageText: {fontSize: 11, marginTop: 5},
  previewWrap: {width: 92, height: 92},
  preview: {width: 92, height: 92, borderRadius: radius.md, backgroundColor: '#E8E9EC'},
  removeImage: {position: 'absolute', right: 4, top: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.64)', alignItems: 'center', justifyContent: 'center'},
  tagInput: {minHeight: 50, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, fontSize: 16},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10},
  tag: {borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13, fontWeight: '700'},
  message: {fontSize: 13, lineHeight: 20, marginTop: 16},
  submit: {marginTop: 22},
  reviewTip: {flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingHorizontal: 4},
  reviewText: {fontSize: 12, lineHeight: 18, flex: 1},
  locked: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32},
  lockIcon: {width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  lockTitle: {fontSize: 22, fontWeight: '900', marginTop: 20},
  lockText: {fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 8, maxWidth: 360},
  lockButton: {width: 220, marginTop: 24},
});
