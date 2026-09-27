import { Request, Response } from 'express';
import { searchEmails, bulkIndexExisting } from '../services/elasticsearchService';

export const search = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const results = await searchEmails(req.user!.id, q);
    res.json(results);
  } catch (error: any) {
    res.status(503).json({ error: error.message });
  }
};

export const triggerBulkIndex = async (req: Request, res: Response) => {
  try {
    await bulkIndexExisting();
    res.json({ message: 'Bulk indexing started' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
