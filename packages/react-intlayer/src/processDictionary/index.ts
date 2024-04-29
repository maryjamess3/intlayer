/* eslint-disable @typescript-eslint/no-explicit-any */
import { type Locales, getConfiguration } from '@intlayer/config/client';
import {
  NodeType,
  type QuantityContent,
  type LanguageContent,
  findMatchingCondition,
} from '@intlayer/core';
import { renderContentEditor } from 'intlayer-editor/client';
import type { KeyPath } from 'intlayer-editor/server';
import { type ReactElement, createElement, type ReactNode } from 'react';
import { getEnumeration } from '../getEnumeration';
import { getTranslation } from '../getTranslation';
import type {
  Content,
  ContentValue,
  TransformedContent,
  TransformedContentValue,
} from './contentDictionary';

const {
  internationalization: { defaultLocale },
} = getConfiguration();

const processTranslation = (
  languageContent: LanguageContent<ContentValue>,
  locale: Locales,
  dictionaryPath: string,
  keyPath: KeyPath[] = []
): TransformedContent => {
  const translationResult: ContentValue = getTranslation<ContentValue>(
    languageContent,
    locale
  );

  const resultKeyPath: KeyPath[] = [
    ...keyPath,
    { type: NodeType.Translation, key: locale },
  ];

  return processDictionary(
    translationResult as Content,
    dictionaryPath,
    resultKeyPath,
    locale
  );
};

const processEnumeration = (
  enumerationContent: QuantityContent<ContentValue>,
  locale: Locales,
  dictionaryPath: string,
  keyPath: KeyPath[] = []
): TransformedContentValue => {
  return (quantity: number): TransformedContentValue => {
    const enumerationResult: ContentValue = getEnumeration<ContentValue>(
      enumerationContent,
      quantity
    );

    const matchingCondition = findMatchingCondition(
      enumerationContent,
      quantity
    );

    const resultKeyPath: KeyPath[] = [
      ...keyPath,
      { type: NodeType.Enumeration, key: matchingCondition.toString() },
    ];

    //
    return processDictionary(
      enumerationResult as Content,
      dictionaryPath,
      resultKeyPath,
      locale
    );
  };
};

const isReactNode = (node: Record<string, unknown>): boolean =>
  typeof node?.key !== 'undefined' && typeof node?.props !== 'undefined';

export const processNode = (
  field: ContentValue | undefined,
  locale: Locales,
  dictionaryPath: string,
  keyPath: KeyPath[] = []
): TransformedContentValue => {
  if (typeof field === 'object') {
    if (field.nodeType === NodeType.Translation) {
      return processTranslation(
        field as LanguageContent<ContentValue>,
        locale,
        dictionaryPath,
        keyPath
      );
    }

    if (field.nodeType === NodeType.Enumeration) {
      return processEnumeration(
        field satisfies QuantityContent<ContentValue>,
        locale,
        dictionaryPath,
        keyPath
      );
    }
  }

  return processDictionary(field as Content, dictionaryPath, keyPath, locale);
};

// This function recursively creates React elements from a given JSON-like structure
const createReactElement = (element: ReactElement) => {
  if (typeof element === 'string') {
    // If it's a string, simply return it (used for text content)
    return element;
  }

  // Destructure the component properties

  const convertChildrenAsArray = (element: ReactElement): ReactElement => {
    if (element?.props && typeof element.props.children === 'object') {
      const childrenResult: ReactNode[] = [];
      const { children } = element.props;

      // Create the children elements recursively, if any
      Object.keys(children).forEach((key) => {
        childrenResult.push(createReactElement(children[key]));
      });

      return {
        ...element,
        props: { ...element.props, children: childrenResult },
      };
    }

    return {
      ...element,
      props: { ...element.props, children: element.props.children },
    };
  };

  const fixedElement = convertChildrenAsArray(element);

  const { type, props } = fixedElement;

  // Create and return the React element
  return createElement(type ?? 'div', props, ...props.children);
};

/**
 * Function that process a dictionary and return the result to be used in the application.
 */
export const processDictionary = (
  content: Content,
  dictionaryPath: string,
  keyPath: KeyPath[] = [],
  locale: Locales = defaultLocale
): TransformedContent => {
  // If it's a React element, render it
  if (isReactNode(content)) {
    return createReactElement(
      content as unknown as ReactElement
    ) as unknown as TransformedContent;
  }

  if (content && typeof content === 'object') {
    const result: TransformedContent = {};

    // List each key in the content and process it
    for (const key of Object.keys(content)) {
      const field = content[key];

      const resultKeyPath: KeyPath[] = [
        ...keyPath,
        { type: 'ObjectExpression', key },
      ];

      result[key] = processNode(field, locale, dictionaryPath, resultKeyPath);
    }

    return result;
  }

  if (typeof content === 'string') {
    try {
      // renderContentEditor come from intlayer-editor, which is an optional dependency.
      // intlayer-editor should be installed in the project to use the content editor.
      return renderContentEditor(content, dictionaryPath, keyPath);
    } catch (e) {
      // If renderContentEditor not available, it will return the content as is.
      return content;
    }
  }

  // If it's a string, number, or function, return it
  return content;
};
