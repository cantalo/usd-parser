const metaRegExpStr = '#(?<key>[a-z]+):(?<value>.+)';
const metaRowRegExp = new RegExp(metaRegExpStr, 'gi');
const metaRegExp = new RegExp(metaRegExpStr, 'i');
const ignoreKeys = /^(cover|video|encoding|background|start)$/i;
const numberKeys = /^(bpm|gap|year|end|videogap|previewstart)$/i;

const songRegExpStr = '(?<type>[:*F-])\\s(?<bpm_start>[0-9-]+)(\\s(?<bpm_length>[0-9]+)\\s(?<pitch>[0-9-]+)\\s(?<text>.+))?';
const songRowRegExp = new RegExp(songRegExpStr, 'g');
const songRegExp = new RegExp(songRegExpStr);

const languageMap = {
  German: 'de',
  Deutsch: 'de',
  English: 'en',
  Englisch: 'en',
  Nederlands: 'nl',
  Dutch: 'nl',
  Spanish: 'es',
};

const typeMapping = {
  ':': 1, // 'REGULAR',
  '*': 2, // 'GOLDEN',
  'F': 0, // 'FREESTYLE',
};

const metaDataReducer = (result, row) =>
{
  let { key, value } = row.match(metaRegExp).groups;

  if (ignoreKeys.test(key)) return result;

  if (numberKeys.test(key))
  {
    value = parseFloat(value.replace(',', '.'));
  }

  if (/language/i.test(key))
  {
    if (value in languageMap)
    {
      value = languageMap[value];
    }
    else
    {
      console.warn('Language ', value, 'is not mapped to a language code.');
    }
  }

  return {
    ...result,
    [key.toLowerCase()]: value,
  };
};

export const getMetaData = content => content.match(metaRowRegExp).reduce(metaDataReducer, {});

export function getSongData(meta, content)
{
  if (/yes/i.test(meta.relative))
  {
    throw new Error('Parsing relative song files is not yet implemented!');
  }

  const song = [];
  let currentLine;

  content.match(songRowRegExp).forEach((row) =>
  {
    const { type, bpm_start, bpm_length, pitch, text } = row.match(songRegExp).groups;
    const newLine = type === '-';

    if (!currentLine || newLine)
    {
      if (newLine)
      {
        currentLine.end = parseInt(bpm_start);

        if (!currentLine.start)
        {
          currentLine.start = currentLine.syllables[0].start;
        }
      }

      currentLine = { syllables: [] };
      song.push(currentLine);

      if (newLine)
      {
        currentLine.start = bpm_length;
        return;
      }
    }

    currentLine.syllables.push({
      type: typeMapping[type],
      start: parseInt(bpm_start),
      length: bpm_length && parseInt(bpm_length, 10),
      pitch: pitch && parseInt(pitch, 10),
      text,
    });
  });

  currentLine.start = currentLine.syllables[0].start;
  currentLine.end = currentLine.syllables[currentLine.syllables.length - 1].start + currentLine.syllables[currentLine.syllables.length - 1].length;

  return song;
}

export default function(content, { transformFields })
{
  const meta = getMetaData(content);

  if (transformFields)
  {
    for (const [field, transform] of Object.entries(transformFields))
    {
      meta[field] = transform(meta[field]);
    }
  }

  const song = getSongData(meta, content);

  return {
    ...meta,
    song,
  };
}