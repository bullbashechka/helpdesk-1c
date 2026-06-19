import { attachmentUrl } from '../api/whatsappApi.js';

const NOTE = {
  too_large: 'Файл слишком большой - откройте в WhatsApp',
  failed: 'Вложение недоступно - попросите клиента переслать',
  not_stored: 'Голосовое сообщение - прослушайте в WhatsApp',
};

export function AttachmentList({ attachments = [] }) {
  if (!attachments.length) return null;

  return (
    <div className="attachment-list">
      {attachments.map((attachment) => {
        if (attachment.availability !== 'stored') {
          return (
            <div key={attachment.id} className="attachment attachment--note">
              {NOTE[attachment.availability] ?? 'Вложение недоступно'}
            </div>
          );
        }

        const url = attachmentUrl(attachment.id);

        if (attachment.kind === 'photo') {
          return (
            <a key={attachment.id} href={url} target="_blank" rel="noreferrer" className="attachment attachment--photo">
              <img src={url} alt={attachment.original_name ?? 'фото'} className="attachment__thumb" />
            </a>
          );
        }

        if (attachment.kind === 'video') {
          return <video key={attachment.id} src={url} controls className="attachment attachment__video" />;
        }

        return (
          <a
            key={attachment.id}
            href={attachmentUrl(attachment.id, { download: true })}
            className="attachment attachment__doc"
          >
            {attachment.original_name ?? 'Документ'}
          </a>
        );
      })}
    </div>
  );
}
