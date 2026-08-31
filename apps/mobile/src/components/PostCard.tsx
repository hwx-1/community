import React, { memo, useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import {
  Bookmark,
  CheckBadge as Check,
  Heart,
  MessageCircle,
  Pin,
  Share2,
} from './AliIcon';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { absoluteMediaUrl, api, formatTime } from '../api/client';
import type { Post } from '../api/types';
import { radius, spacing, useAppTheme } from '../theme';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';

type Props = {
  post: Post;
  onOpen: () => void;
};

const statusLabels: Record<string, string> = {
  pending: '审核中',
  rejected: '未通过',
  reported_hidden: '复核中',
  removed: '已下架',
  deleted: '已删除',
};

export const PostCard = memo(function PostCardComponent({
  post,
  onOpen,
}: Props) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(post);
  const [error, setError] = useState('');
  const images = current.images ?? [];
  const tags = current.tags ?? [];

  useEffect(() => setCurrent(post), [post]);

  const interaction = useMutation({
    mutationFn: (kind: 'like' | 'bookmark') =>
      kind === 'like' ? api.likePost(current.id) : api.bookmarkPost(current.id),
    onMutate: kind => {
      const previous = current;
      setCurrent(value =>
        kind === 'like'
          ? {
              ...value,
              liked: !value.liked,
              likes: Math.max(0, value.likes + (value.liked ? -1 : 1)),
            }
          : { ...value, bookmarked: !value.bookmarked },
      );
      setError('');
      return { previous };
    },
    onSuccess: result => {
      setCurrent(result.post);
      setError('');
      queryClient.setQueryData(['post', current.id], { post: result.post });
    },
    onError: (reason: Error, _kind, context) => {
      if (context?.previous) setCurrent(context.previous);
      setError(reason.message);
    },
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Avatar uri={current.author.avatar} name={current.author.nickname} />
        <View style={styles.authorMeta}>
          <View style={styles.authorLine}>
            <Text
              style={[styles.author, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {current.author.nickname}
            </Text>
            {current.author.verified ? (
              <Check
                size={15}
                strokeWidth={3}
                color={theme.colors.primary}
                accessibilityLabel="已认证"
              />
            ) : null}
          </View>
          <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
            {formatTime(current.created_at)}
          </Text>
        </View>
        {current.pinned ? (
          <View
            style={[
              styles.status,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <Pin size={13} color={theme.colors.primary} />
            <Text style={[styles.statusText, { color: theme.colors.primary }]}>
              置顶
            </Text>
          </View>
        ) : null}
        {current.status !== 'public' ? (
          <View
            style={[
              styles.status,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text
              style={[styles.statusText, { color: theme.colors.textSecondary }]}
            >
              {statusLabels[current.status] ?? current.status}
            </Text>
          </View>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看帖子详情"
        onPress={onOpen}
      >
        <Text style={[styles.body, { color: theme.colors.text }]}>
          {current.text}
        </Text>
        {images.length ? (
          <View style={styles.imageGrid}>
            {images.slice(0, 3).map((image, index) => (
              <View key={`${image}-${index}`} style={styles.imageWrap}>
                <Image
                  source={{ uri: absoluteMediaUrl(image) }}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityLabel={`帖子图片 ${index + 1}`}
                />
                {index === 2 && images.length > 3 ? (
                  <View style={styles.moreImages}>
                    <Text style={styles.moreImagesText}>
                      +{images.length - 3}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </Pressable>

      {tags.length ? (
        <View style={styles.tags} accessibilityLabel="帖子标签">
          {tags.map(tag => (
            <Text
              key={tag}
              style={[
                styles.tag,
                {
                  color: theme.colors.primary,
                  backgroundColor: theme.colors.primarySoft,
                },
              ]}
            >
              # {tag}
            </Text>
          ))}
        </View>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.error, { color: theme.colors.danger }]}
        >
          {error}
        </Text>
      ) : null}

      <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
        <Action
          active={current.liked}
          label={current.likes > 0 ? `赞同 ${current.likes}` : '赞同'}
          icon={Heart}
          disabled={interaction.isPending}
          onPress={() => interaction.mutate('like')}
        />
        <Action
          label={current.comments > 0 ? `${current.comments} 条评论` : '评论'}
          icon={MessageCircle}
          onPress={onOpen}
        />
        <Action
          active={current.bookmarked}
          label={current.bookmarked ? '已收藏' : '收藏'}
          icon={Bookmark}
          disabled={interaction.isPending}
          onPress={() => interaction.mutate('bookmark')}
        />
        <Action
          label="分享"
          icon={Share2}
          onPress={() =>
            Share.share({
              message: `${current.text.slice(0, 80)}\nhttps://xsnbb.xyz/posts/${
                current.id
              }`,
            }).catch(() => undefined)
          }
        />
      </View>
    </View>
  );
});

function Action({
  label,
  icon: Icon,
  active,
  disabled,
  onPress,
}: {
  label: string;
  icon: typeof Heart;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const color = active ? theme.colors.primary : theme.colors.textSecondary;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.action, disabled && styles.actionDisabled]}
      pressedStyle={{ backgroundColor: theme.colors.surfaceMuted }}
      pressedScale={0.94}
    >
      <Icon size={19} color={color} fill={active ? color : 'transparent'} />
      <Text style={[styles.actionText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: 12,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorMeta: { flex: 1, marginLeft: 12 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  author: { fontSize: 15, fontWeight: '700', maxWidth: 170 },
  time: { fontSize: 12, marginTop: 3 },
  status: {
    height: 28,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  body: {
    fontSize: 16,
    lineHeight: 25,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  imageGrid: {
    height: 180,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.md,
    marginBottom: 12,
  },
  imageWrap: { flex: 1, borderRadius: radius.sm, overflow: 'hidden' },
  image: { width: '100%', height: '100%', backgroundColor: '#E8E9EC' },
  moreImages: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: 14,
  },
  tag: {
    fontSize: 13,
    fontWeight: '600',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  error: { fontSize: 13, paddingHorizontal: spacing.md, paddingBottom: 8 },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionDisabled: { opacity: 0.55 },
  actionText: { fontSize: 12, fontWeight: '600' },
});
