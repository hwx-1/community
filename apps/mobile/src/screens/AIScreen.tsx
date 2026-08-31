import React, {useMemo, useState} from 'react';
import {FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Bot, Plus, Send, Sparkles} from '../components/AliIcon';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api, formatTime} from '../api/client';
import type {AIConversation, AIMessage} from '../api/types';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

export function AIScreen() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const conversations = useQuery({queryKey: ['ai-conversations'], queryFn: api.aiConversations});
  const models = useQuery({queryKey: ['ai-models'], queryFn: api.aiModels});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const current = useMemo(() => {
    const items = conversations.data?.items ?? [];
    if (selectedId === -1) return null;
    return items.find(item => item.id === selectedId) ?? items[0] ?? null;
  }, [conversations.data?.items, selectedId]);
  const model = models.data?.items.find(item => item.enabled && item.public)?.model;

  const ask = useMutation({
    mutationFn: async () => {
      let conversation: AIConversation;
      if (current) conversation = current;
      else conversation = (await api.createAIConversation(text.trim().slice(0, 20) || '新对话', model)).conversation;
      return api.askAI(conversation.id, text.trim(), model);
    },
    onSuccess: () => { setText(''); setError(''); void queryClient.invalidateQueries({queryKey: ['ai-conversations']}); },
    onError: (reason: Error) => setError(reason.message),
  });
  if (conversations.isLoading) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState loading /></SafeAreaView>;
  if (conversations.isError) return <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]}><ScreenState title="AI 助手暂不可用" message={(conversations.error as Error).message} actionLabel="重试" onAction={() => void conversations.refetch()} /></SafeAreaView>;
  const messages = [...(current?.messages ?? [])].reverse();
  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
        <View style={[styles.hero, {backgroundColor: theme.colors.primarySoft}]}>
          <View style={[styles.bot, {backgroundColor: theme.colors.primary}]}><Bot size={22} color="#FFFFFF" /></View>
          <View style={styles.heroBody}><Text style={[styles.heroTitle, {color: theme.colors.text}]}>校园 AI 助手</Text><Text style={[styles.heroText, {color: theme.colors.textSecondary}]}>今日剩余 {conversations.data?.remaining ?? 0} 次 · 回答请以学校官方信息为准</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="新建 AI 对话" onPress={() => setSelectedId(-1)} style={styles.newChat}><Plus size={21} color={theme.colors.primary} /></Pressable>
        </View>
        <FlatList
          inverted
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <AIMessageBubble item={item} />}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={<View style={styles.empty}><Sparkles size={32} color={theme.colors.primary} /><Text style={[styles.emptyTitle, {color: theme.colors.text}]}>想了解什么校园信息？</Text><Text style={[styles.emptyText, {color: theme.colors.textSecondary}]}>可以问部门电话、办事流程、校园通知等。</Text></View>}
        />
        {error ? <Text accessibilityRole="alert" style={[styles.error, {color: theme.colors.danger}]}>{error}</Text> : null}
        <View style={[styles.composer, {backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border}]}>
          <TextInput accessibilityLabel="向校园 AI 提问" value={text} onChangeText={setText} multiline maxLength={1000} placeholder="输入你的问题…" placeholderTextColor={theme.colors.textSecondary} style={[styles.input, {color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted}]} />
          <Pressable accessibilityRole="button" accessibilityLabel="发送问题" disabled={!text.trim() || ask.isPending || (conversations.data?.remaining ?? 0) <= 0} onPress={() => ask.mutate()} style={({pressed}) => [styles.send, {backgroundColor: theme.colors.primary, opacity: !text.trim() || ask.isPending ? 0.4 : pressed ? 0.75 : 1}]}><Send size={20} color="#FFFFFF" /></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AIMessageBubble({item}: {item: AIMessage}) {
  const theme = useAppTheme(); const mine = item.role === 'user';
  return <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}><View style={[styles.bubble, {backgroundColor: mine ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border}]}><Text style={[styles.bubbleText, {color: mine ? '#FFFFFF' : theme.colors.text}]}>{item.text}</Text><Text style={[styles.bubbleTime, {color: mine ? 'rgba(255,255,255,0.72)' : theme.colors.textSecondary}]}>{formatTime(item.created_at)}{item.source ? ` · ${item.source}` : ''}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: {flex: 1}, hero: {margin: spacing.md, marginBottom: 0, borderRadius: radius.md, padding: 13, flexDirection: 'row', alignItems: 'center'}, bot: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'}, heroBody: {flex: 1, marginLeft: 11}, heroTitle: {fontSize: 15, fontWeight: '900'}, heroText: {fontSize: 11, marginTop: 3}, newChat: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  messages: {padding: spacing.md}, empty: {alignItems: 'center', justifyContent: 'center', paddingVertical: 80}, emptyTitle: {fontSize: 18, fontWeight: '900', marginTop: 14}, emptyText: {fontSize: 13, marginTop: 6},
  bubbleRow: {alignItems: 'flex-start', marginBottom: 10}, bubbleRowMine: {alignItems: 'flex-end'}, bubble: {maxWidth: '84%', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10}, bubbleText: {fontSize: 15, lineHeight: 23}, bubbleTime: {fontSize: 10, marginTop: 5, alignSelf: 'flex-end'},
  error: {fontSize: 12, textAlign: 'center', padding: 6}, composer: {borderTopWidth: StyleSheet.hairlineWidth, minHeight: 76, padding: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 9}, input: {flex: 1, minHeight: 48, maxHeight: 110, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15}, send: {width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center'},
});
