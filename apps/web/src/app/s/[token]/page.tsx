import ShareClient from './ShareClient';

export function generateStaticParams() {
  return [{ token: 'preview' }];
}

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function SharePage(props: SharePageProps) {
  const { params } = props;

  return <ShareClient params={params} />;
}
