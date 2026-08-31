import React, {useState} from 'react';
import {Alert, FlatList, Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {ChevronDown, ChevronUp, ExternalLink, Megaphone} from '../components/AliIcon';
import {useQuery} from '@tanstack/react-query';
import {SafeAreaView} from 'react-native-safe-area-context';
import {absoluteMediaUrl, api, formatTime} from '../api/client';
import type {Announcement} from '../api/types';
import {ScreenState} from '../components/ScreenState';
import {radius, spacing, useAppTheme} from '../theme';

export function AnnouncementsScreen() {
  const theme = useAppTheme();
  const query = useQuery({queryKey: ['announcements'], queryFn: api.listAnnouncements});
  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.colors.background}]} edges={['bottom']}>
      {query.isLoading ? <ScreenState loading /> : query.isError ? <ScreenState title="公告加载失败" message={(query.error as Error).message} actionLabel="重试" onAction={() => void query.refetch()} /> : (
        <FlatList data={query.data?.items ?? []} keyExtractor={item => String(item.id)} renderItem={({item}) => <AnnouncementCard item={item} />} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={theme.colors.primary} />} ListEmptyComponent={<ScreenState title="暂无平台公告" />} />
      )}
    </SafeAreaView>
  );
}

function AnnouncementCard({item}: {item: Announcement}) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const openLink = async () => {
    if (!item.link_url) return;
    try {
      await Linking.openURL(item.link_url);
    } catch {
      Alert.alert('无法打开链接', '请稍后重试或检查设备的浏览器设置。');
    }
  };

  return (
    <View style={[styles.card, {backgroundColor: theme.colors.surface, borderColor: theme.colors.border}]}>
      {item.image_url && (
        <Image
          source={{uri: absoluteMediaUrl(item.image_url)}}
          style={styles.cover}
          resizeMode="cover"
          accessibilityLabel={`${item.title}公告配图`}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${open ? '收起' : '展开'}公告：${item.title}`}
        accessibilityState={{expanded: open}}
        onPress={() => setOpen(value => !value)}
        style={({pressed}) => [styles.content, {opacity: pressed ? 0.7 : 1}]}>
        <View style={[styles.icon, {backgroundColor: theme.colors.primarySoft}]}>
          <Megaphone size={20} color={theme.colors.primary} />
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, {color: theme.colors.text}]}>{item.title}</Text>
          <Text style={[styles.time, {color: theme.colors.textSecondary}]}>
            {formatTime(item.published_at ?? item.created_at)}
          </Text>
          <Text
            style={[styles.summary, {color: open ? theme.colors.text : theme.colors.textSecondary}]}
            numberOfLines={open ? undefined : 2}>
            {open ? item.body : item.summary}
          </Text>
        </View>
        {open ? <ChevronUp size={18} color={theme.colors.textSecondary} /> : <ChevronDown size={18} color={theme.colors.textSecondary} />}
      </Pressable>
      {open && item.link_url && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={item.link_text || '查看详情'}
          onPress={() => void openLink()}
          style={({pressed}) => [styles.linkButton, {backgroundColor: theme.colors.primarySoft, opacity: pressed ? 0.7 : 1}]}>
          <ExternalLink size={16} color={theme.colors.primary} />
          <Text style={[styles.linkText, {color: theme.colors.primary}]}>{item.link_text || '查看详情'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({safe: {flex: 1}, list: {padding: spacing.md, paddingBottom: 40}, card: {overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, marginBottom: 12}, cover: {width: '100%', aspectRatio: 16 / 9}, content: {padding: 14, flexDirection: 'row', alignItems: 'flex-start'}, icon: {width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center'}, body: {flex: 1, marginHorizontal: 12}, title: {fontSize: 16, fontWeight: '900'}, time: {fontSize: 11, marginTop: 3}, summary: {fontSize: 14, lineHeight: 22, marginTop: 9}, linkButton: {minHeight: 44, marginHorizontal: 14, marginBottom: 14, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7}, linkText: {fontSize: 14, fontWeight: '800'}});
