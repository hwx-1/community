import React, {useState} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {Bell, ChevronRight} from '../components/AliIcon';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {api, formatTime} from '../api/client';
import type {AppNotification, DirectConversationItem} from '../api/types';
import type {RootStackParamList} from '../navigation/types';
import {Avatar} from '../components/Avatar';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

export function MessagesScreen() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<'notifications' | 'direct'>('notifications');
  const notifications = useQuery({queryKey: ['notifications'], queryFn: api.notifications});
  const direct = useQuery({queryKey: ['direct-conversations'], queryFn: api.listDirectConversations});
  const markRead = useMutation({
    mutationFn: (id: number) => api.markNotificationsRead([id]),
    onSuccess: () => void queryClient.invalidateQueries({queryKey: ['notifications']}),
  });
  const current = mode === 'notifications' ? notifications : direct;

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, {color: theme.colors.text}]}>消息</Text>
        {(notifications.data?.unread ?? 0) > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => api.markNotificationsRead().then(() => queryClient.invalidateQueries({queryKey: ['notifications']}))}
            style={({pressed}) => [styles.readAll, {opacity: pressed ? 0.6 : 1}]}>
            <Text style={[styles.readAllText, {color: theme.colors.primary}]}>全部已读</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.switcher, {backgroundColor: theme.colors.surfaceMuted}]}>
        <ModeButton label={`通知${notifications.data?.unread ? ` ${notifications.data.unread}` : ''}`} selected={mode === 'notifications'} onPress={() => setMode('notifications')} />
        <ModeButton label="私信" selected={mode === 'direct'} onPress={() => setMode('direct')} />
      </View>

      {current.isLoading ? <ScreenState loading /> : current.isError ? (
        <ScreenState title="消息加载失败" message={(current.error as Error).message} actionLabel="重试" onAction={() => void current.refetch()} />
      ) : mode === 'notifications' ? (
        <FlatList
          data={notifications.data?.items ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <NotificationRow item={item} onPress={() => !item.read && markRead.mutate(item.id)} />}
          refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()} tintColor={theme.colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ScreenState title="暂无新通知" message="评论、官方回答和处理结果会显示在这里。" />}
        />
      ) : (
        <FlatList
          data={direct.data?.items ?? []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <ConversationRow item={item} onPress={() => navigation.navigate('Chat', {conversationId: item.id, title: item.other.nickname})} />}
          refreshControl={<RefreshControl refreshing={direct.isRefetching} onRefresh={() => void direct.refetch()} tintColor={theme.colors.primary} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<ScreenState title="还没有私信" message="从同学的公开主页可以发起第一次联系。" />}
        />
      )}
    </SafeAreaView>
  );
}

function ModeButton({label, selected, onPress}: {label: string; selected: boolean; onPress: () => void}) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{selected}} onPress={onPress} style={[styles.modeButton, selected && {backgroundColor: theme.colors.surface}]}>
      <Text style={[styles.modeText, {color: selected ? theme.colors.text : theme.colors.textSecondary}]}>{label}</Text>
    </Pressable>
  );
}

function NotificationRow({item, onPress}: {item: AppNotification; onPress: () => void}) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({pressed}) => [styles.row, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.75 : 1}]}>
      <View style={[styles.rowIcon, {backgroundColor: item.read ? theme.colors.surfaceMuted : theme.colors.primarySoft}]}><Bell size={20} color={item.read ? theme.colors.textSecondary : theme.colors.primary} /></View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, {color: theme.colors.text}]} numberOfLines={1}>{item.title}</Text>
          {!item.read ? <View style={[styles.unread, {backgroundColor: theme.colors.primary}]} accessibilityLabel="未读" /> : null}
        </View>
        <Text style={[styles.rowText, {color: theme.colors.textSecondary}]} numberOfLines={2}>{item.body}</Text>
        <Text style={[styles.rowTime, {color: theme.colors.textSecondary}]}>{formatTime(item.created_at)}</Text>
      </View>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

function ConversationRow({item, onPress}: {item: DirectConversationItem; onPress: () => void}) {
  const theme = useAppTheme();
  const last = item.messages[item.messages.length - 1];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`与${item.other.nickname}的私信`} onPress={onPress} style={({pressed}) => [styles.row, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.75 : 1}]}>
      <Avatar uri={item.other.avatar} name={item.other.nickname} size={48} />
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, {color: theme.colors.text}]}>{item.other.nickname}</Text>
          <Text style={[styles.rowTime, {color: theme.colors.textSecondary}]}>{formatTime(item.updated_at)}</Text>
        </View>
        <Text style={[styles.rowText, {color: theme.colors.textSecondary}]} numberOfLines={1}>{last?.text ?? '开始新的对话'}</Text>
        {!item.unlocked ? <Text style={[styles.handshake, {color: theme.colors.primary}]}>等待双方回应后解锁自由消息</Text> : null}
      </View>
      <ChevronRight size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {height: 66, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  title: {fontSize: 28, fontWeight: '900'},
  readAll: {minHeight: 48, justifyContent: 'center', paddingLeft: 16},
  readAllText: {fontSize: 14, fontWeight: '700'},
  switcher: {height: 44, marginHorizontal: spacing.md, borderRadius: 13, padding: 3, flexDirection: 'row', marginBottom: 12},
  modeButton: {flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center'},
  modeText: {fontSize: 14, fontWeight: '800'},
  list: {paddingHorizontal: spacing.md, paddingBottom: 120},
  row: {minHeight: 92, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10},
  rowIcon: {width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
  rowBody: {flex: 1, marginLeft: 12},
  rowTitleLine: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8},
  rowTitle: {fontSize: 15, fontWeight: '800', flexShrink: 1},
  rowText: {fontSize: 13, lineHeight: 19, marginTop: 4},
  rowTime: {fontSize: 11},
  unread: {width: 8, height: 8, borderRadius: 4},
  handshake: {fontSize: 11, marginTop: 4},
});
