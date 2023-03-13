import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        {/* HTML Meta Tags  */}
        <meta property='og:url' content='your url' />
        <meta property='og:type' content='website' />
        <meta property='og:title' content='Context' />
        <meta
          property='og:description'
          content='context is the key to narrative storytelling'
        />
        <meta
          property='og:image'
          content='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqjy8ZRHjNBs1EgrDGihwNV03homRyqVVPLQ&usqp=CAU'
        />
        <meta property='og:image:height' content='630' />
        <meta property='og:image:width' content='1200' />
        <meta
          property='og:video'
          content='https://www.youtube.com/v/BQBjVr1iHH4'
        />

        {/* Twitter Meta Tags  */}
        <meta name='twitter:card' content='summary_large_image' />
        <meta property='twitter:domain' content='context-gamma.vercel.app' />
        <meta name='twitter:player' content='https://wakey.io/embed/26' />
        <meta name='twitter:player:width' content='720' />
        <meta name='twitter:player:height' content='720' />
        {/* <meta
          property='twitter:url'
          content='https://www.youtube.com/live/taWdpJmaQZA?feature=share'
        /> */}
        <meta name='twitter:title' content='Context' />
        <meta
          name='twitter:description'
          content='context is the key to narrative storytelling'
        />
        <meta
          name='twitter:image'
          content='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqjy8ZRHjNBs1EgrDGihwNV03homRyqVVPLQ&usqp=CAU'
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
