import React from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {absoluteMediaUrl} from '../api/client';
import {useAppTheme} from '../theme';

type Props = {
  uri?: string;
  name: string;
  size?: number;
};

export function Avatar({uri, name, size = 44}: Props) {
  const theme = useAppTheme();
  const resolved = absoluteMediaUrl(uri);
  const shape = {width: size, height: size, borderRadius: size / 2};

  if (resolved) {
    return <Image source={{uri: resolved}} style={[styles.image, shape]} accessibilityLabel={`${name}的头像`} />;
  }

  return (
    <View style={[styles.fallback, shape, {backgroundColor: theme.colors.primarySoft}]} accessibilityLabel={`${name}的默认头像`}>
      <Text style={[styles.letter, {color: theme.colors.primary, fontSize: Math.max(16, size * 0.38)}]}>
        {name.trim().slice(0, 1) || '同'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {backgroundColor: '#E8E9EC'},
  fallback: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  letter: {fontWeight: '700'},
});
