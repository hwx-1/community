import React, {useState} from 'react';
import {FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Send} from '../components/AliIcon';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api, formatTime} from '../api/client';
import type {DirectMessage} from '../api/types';
import {useAuth} from '../auth/AuthContext';
import type {RootStackParamList} from '../navigation/types';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

export function ChatScreen({route}: Props) {
  const theme = useAppTheme();
  const {account} = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const query = useQuery({queryKey: ['chat', route.params.conversationId], queryFn: () => api.getDirectConversation(route.params.conversationId)});
  const send = useMutation({
    mutationFn: (system: boolean) => system
      ? api.sendSystemGreeting(route.params.conversationId)
      : api.sendDirectMessage(route.params.conversationId, text.trim()),
    onSuccess: () => {
      setText('');
      setError('');
      void queryClient.invalidateQueries({queryKey: ['chat', route.params.conversationId]});
      void queryClient.invalidateQueries({queryKey: ['direct-conversations']});
    },
    onError: (reason: Error) => setError(reason.message),
  });

  if (query.isLoading) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState loading /></SafeAreaView>;
  if (query.isError || !query.data) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState title="会话加载失败" message={(query.error as Error)?.message} actionLabel="重试" onAction={() => void query.refetch()} /></SafeAreaView>;

  const messages = [...query.data.conversation.messages].reverse();
  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        {!query.data.unlocked ? <View style={[styles.notice, {backgroundColor: theme.colors.primarySoft}]}><Text style={[styles.noticeText, {color: theme.colors.text}]}>首次联系先发送平台预设招呼；对方回应后即可自由聊天。</Text><Pressable accessibilityRole="button" accessibilityLabel="发送预设招呼" disabled={send.isPending} onPress={() => send.mutate(true)} style={({pressed}) => [styles.greetingButton, {backgroundColor: theme.colors.primary, opacity: send.isPending ? 0.4 : pressed ? 0.75 : 1}]}><Text style={styles.greetingText}>发送招呼</Text></Pressable></View> : null}
        <FlatList
          inverted
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <Bubble item={item} mine={item.sender_id === account?.id} />}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={<ScreenState title="开始对话" message="请友善交流，不要发送敏感个人信息。" />}
        />
        {error ? <Text accessibilityRole="alert" style={[styles.error, {color: theme.colors.danger}]}>{error}</Text> : null}
        {query.data.unlocked ? <View style={[styles.composer, {backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border}]}>
          <TextInput
            accessibilityLabel="私信内容"
            value={text}
            onChangeText={setText}
            placeholder="输入消息…"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.input, {backgroundColor: theme.colors.surfaceMuted, color: theme.colors.text}]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="发送私信"
            disabled={!text.trim() || send.isPending}
            onPress={() => send.mutate(false)}
            style={({pressed}) => [styles.send, {backgroundColor: theme.colors.primary, opacity: !text.trim() || send.isPending ? 0.4 : pressed ? 0.75 : 1}]}>
            <Send size={20} color="#FFFFFF" />
          </Pressable>
        </View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({item, mine}: {item: DirectMessage; mine: boolean}) {
  const theme = useAppTheme();
  const textColor = {color: mine ? '#FFFFFF' : theme.colors.text};
  const timeColor = {color: mine ? 'rgba(255,255,255,0.72)' : theme.colors.textSecondary};
  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, {backgroundColor: mine ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border}]}>
        <Text style={[styles.bubbleText, textColor]}>{item.text}</Text>
        <Text style={[styles.bubbleTime, timeColor]}>{formatTime(item.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  notice: {paddingHorizontal: spacing.md, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10},
  noticeText: {fontSize: 12, lineHeight: 18, flex: 1},
  greetingButton: {minWidth: 92, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12},
  greetingText: {color: '#FFFFFF', fontSize: 13, fontWeight: '800'},
  messages: {padding: spacing.md},
  bubbleRow: {alignItems: 'flex-start', marginBottom: 10},
  bubbleRowMine: {alignItems: 'flex-end'},
  bubble: {maxWidth: '78%', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10},
  bubbleText: {fontSize: 15, lineHeight: 22},
  bubbleTime: {fontSize: 10, marginTop: 4, alignSelf: 'flex-end'},
  error: {fontSize: 12, textAlign: 'center', paddingVertical: 6},
  composer: {borderTopWidth: StyleSheet.hairlineWidth, minHeight: 72, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10},
  input: {flex: 1, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 16, fontSize: 15},
  send: {width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
});
