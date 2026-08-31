import React, {useState} from 'react';
import {FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Send} from '../components/AliIcon';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api, formatTime} from '../api/client';
import type {CommentItem} from '../api/types';
import type {RootStackParamList} from '../navigation/types';
import {Avatar} from '../components/Avatar';
import {PostCard} from '../components/PostCard';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

export function PostDetailScreen({route}: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const post = useQuery({queryKey: ['post', route.params.postId], queryFn: () => api.getPost(route.params.postId)});
  const comments = useQuery({queryKey: ['comments', route.params.postId], queryFn: () => api.listComments(route.params.postId)});
  const send = useMutation({
    mutationFn: () => api.createComment(route.params.postId, text.trim()),
    onSuccess: result => {
      setText('');
      setError(result.message ?? '评论已提交');
      void queryClient.invalidateQueries({queryKey: ['comments', route.params.postId]});
      void queryClient.invalidateQueries({queryKey: ['post', route.params.postId]});
    },
    onError: (reason: Error) => setError(reason.message),
  });

  if (post.isLoading) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState loading /></SafeAreaView>;
  if (post.isError || !post.data) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState title="帖子加载失败" message={(post.error as Error)?.message} actionLabel="重试" onAction={() => void post.refetch()} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <FlatList
          data={comments.data?.items ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <CommentRow item={item} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<View><PostCard post={post.data.post} onOpen={() => {}} /><Text style={[styles.commentTitle, {color: theme.colors.text}]}>评论 {post.data.post.comments}</Text></View>}
          ListEmptyComponent={comments.isLoading ? <ScreenState loading /> : <ScreenState title="还没有评论" message="说点友善又有帮助的话吧。" />}
        />
        <View style={[styles.composer, {backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border}]}>
          <TextInput
            accessibilityLabel="评论内容"
            value={text}
            onChangeText={setText}
            maxLength={500}
            placeholder="写下你的评论…"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.input, {backgroundColor: theme.colors.surfaceMuted, color: theme.colors.text}]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送评论"
            accessibilityState={{disabled: !text.trim() || send.isPending, busy: send.isPending}}
            disabled={!text.trim() || send.isPending}
            onPress={() => send.mutate()}
            style={({pressed}) => [styles.send, {backgroundColor: theme.colors.primary, opacity: !text.trim() || send.isPending ? 0.4 : pressed ? 0.75 : 1}]}>
            <Send size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={[styles.feedback, {color: error.includes('提交') ? theme.colors.success : theme.colors.danger, backgroundColor: theme.colors.surface}]}>{error}</Text> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CommentRow({item}: {item: CommentItem}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.comment, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
      <Avatar uri={item.author.avatar} name={item.author.nickname} size={40} />
      <View style={styles.commentBody}>
        <View style={styles.commentHead}><Text style={[styles.commentAuthor, {color: theme.colors.text}]}>{item.author.nickname}</Text><Text style={[styles.commentTime, {color: theme.colors.textSecondary}]}>{formatTime(item.created_at)}</Text></View>
        <Text style={[styles.commentText, {color: theme.colors.text}]}>{item.deleted ? '该评论已删除' : item.text}</Text>
        {item.status !== 'public' ? <Text style={[styles.commentStatus, {color: theme.colors.primary}]}>{item.status === 'pending' ? '审核中，仅自己可见' : item.status}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  list: {paddingTop: 12, paddingBottom: 24},
  commentTitle: {fontSize: 20, fontWeight: '900', paddingHorizontal: spacing.md, paddingTop: 14, paddingBottom: 12},
  comment: {borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: 10, padding: 14},
  commentBody: {flex: 1, marginLeft: 11},
  commentHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  commentAuthor: {fontSize: 14, fontWeight: '800'},
  commentTime: {fontSize: 11},
  commentText: {fontSize: 15, lineHeight: 23, marginTop: 6},
  commentStatus: {fontSize: 11, marginTop: 5},
  composer: {borderTopWidth: StyleSheet.hairlineWidth, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10},
  input: {flex: 1, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 16, fontSize: 15},
  send: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  feedback: {fontSize: 12, textAlign: 'center', paddingVertical: 6},
});
