import FileRequestClient from './FileRequestClient';

export function generateStaticParams() {
  return [{ token: 'preview' }];
}

interface FileRequestPageProps {
  params: Promise<{ token: string }>;
}

export default function FileRequestPage(props: FileRequestPageProps) {
  const { params } = props;

  return <FileRequestClient params={params} />;
}
