/**
 * Folder Management Methods
 * Handles hierarchical folder organization for collections
 */

class FolderManager {
  constructor(db) {
    this.db = db;  // Reference to main Database instance
  }

  /**
   * Create a new folder
   * @param {string} name - Folder name
   * @param {number|null} parentFolderId - Parent folder ID (null for root)
   * @param {Object} options - { description, color, icon }
   * @returns {Promise<number>} New folder ID
   */
  async createFolder(name, parentFolderId = null, options = {}) {
    // Validate: no circular references
    if (parentFolderId) {
      const wouldCreateCycle = await this.wouldCreateCircularReference(parentFolderId, null);
      if (wouldCreateCycle) {
        throw new Error('Cannot create folder: would create circular reference');
      }
    }

    // Insert folder
    const sql = `
      INSERT INTO folders (name, parent_folder_id, description, color, icon)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await this.db.run(sql, [
      name,
      parentFolderId,
      options.description || null,
      options.color || '#6366f1',
      options.icon || null
    ]);

    // Update parent's collection_count if needed
    if (parentFolderId) {
      await this.updateFolderMetadata(parentFolderId);
    }

    return result.lastID;
  }

  /**
   * Get folder by ID
   */
  async getFolder(folderId) {
    const sql = 'SELECT * FROM folders WHERE id = ?';
    return await this.db.get(sql, [folderId]);
  }

  /**
   * Get all child folders of a parent (or root folders if parentId is null)
   */
  async getChildFolders(parentFolderId = null) {
    const sql = `
      SELECT * FROM folders
      WHERE parent_folder_id ${parentFolderId === null ? 'IS NULL' : '= ?'}
      AND archived = 0
      ORDER BY name ASC
    `;
    return await this.db.all(sql, parentFolderId === null ? [] : [parentFolderId]);
  }

  /**
   * Get collections in a folder
   */
  async getCollectionsInFolder(folderId = null) {
    const sql = `
      SELECT * FROM collections
      WHERE folder_id ${folderId === null ? 'IS NULL' : '= ?'}
      AND archived = 0
      ORDER BY created_at DESC
    `;
    return await this.db.all(sql, folderId === null ? [] : [folderId]);
  }

  /**
   * Get full folder contents (folders + collections)
   */
  async getFolderContents(folderId = null) {
    const folders = await this.getChildFolders(folderId);
    const collections = await this.getCollectionsInFolder(folderId);

    return {
      folders,
      collections
    };
  }

  /**
   * Move folder to new parent
   * @param {number} folderId - Folder to move
   * @param {number|null} newParentId - New parent (null for root)
   */
  async moveFolder(folderId, newParentId) {
    // Validate: cannot move folder into itself or its children
    if (newParentId) {
      const wouldCreateCycle = await this.wouldCreateCircularReference(newParentId, folderId);
      if (wouldCreateCycle) {
        throw new Error('Cannot move folder: would create circular reference');
      }
    }

    // Get old parent before moving
    const oldFolder = await this.getFolder(folderId);
    const oldParentId = oldFolder.parent_folder_id;

    const sql = `
      UPDATE folders
      SET parent_folder_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [newParentId, folderId]);

    // Update metadata for old and new parents
    if (oldParentId) {
      await this.updateFolderMetadata(oldParentId);
    }
    if (newParentId) {
      await this.updateFolderMetadata(newParentId);
    }
  }

  /**
   * Rename folder
   */
  async renameFolder(folderId, newName) {
    const sql = `
      UPDATE folders
      SET name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await this.db.run(sql, [newName, folderId]);
  }

  /**
   * Delete folder
   * @param {number} folderId
   * @param {boolean} cascade - If true, delete all children; if false, move children to parent
   */
  async deleteFolder(folderId, cascade = false) {
    const folder = await this.getFolder(folderId);

    if (cascade) {
      // CASCADE DELETE is handled by foreign key constraint
      // Just delete the folder, children will be auto-deleted
      await this.db.run('DELETE FROM folders WHERE id = ?', [folderId]);
    } else {
      // Move children to this folder's parent
      const children = await this.getChildFolders(folderId);
      for (const child of children) {
        await this.moveFolder(child.id, folder.parent_folder_id);
      }

      // Move collections to this folder's parent
      await this.db.run(
        'UPDATE collections SET folder_id = ? WHERE folder_id = ?',
        [folder.parent_folder_id, folderId]
      );

      // Now delete the empty folder
      await this.db.run('DELETE FROM folders WHERE id = ?', [folderId]);
    }

    // Update parent metadata
    if (folder.parent_folder_id) {
      await this.updateFolderMetadata(folder.parent_folder_id);
    }
  }

  /**
   * Get folder path (e.g., "/Research/CTE Study/2025")
   */
  async getFolderPath(folderId) {
    const sql = `
      WITH RECURSIVE folder_path AS (
        SELECT id, name, parent_folder_id, 0 as depth
        FROM folders WHERE id = ?
        UNION ALL
        SELECT f.id, f.name, f.parent_folder_id, fp.depth + 1
        FROM folders f
        JOIN folder_path fp ON f.id = fp.parent_folder_id
      )
      SELECT group_concat(name, '/') as path
      FROM (SELECT name FROM folder_path ORDER BY depth DESC)
    `;
    const result = await this.db.get(sql, [folderId]);
    return result && result.path ? '/' + result.path : '/';
  }

  /**
   * Get full folder lineage (from root to target)
   */
  async getFolderLineage(folderId) {
    const sql = `
      WITH RECURSIVE folder_lineage AS (
        SELECT * FROM folders WHERE id = ?
        UNION ALL
        SELECT f.* FROM folders f
        JOIN folder_lineage fl ON f.id = fl.parent_folder_id
      )
      SELECT * FROM folder_lineage ORDER BY id ASC
    `;
    return await this.db.all(sql, [folderId]);
  }

  /**
   * Check if moving folderId to newParentId would create a circular reference
   */
  async wouldCreateCircularReference(newParentId, folderId) {
    // If newParentId is null (root), no cycle possible
    if (!newParentId) return false;

    // If trying to move folder into itself
    if (newParentId === folderId) return true;

    // Check if newParentId is a descendant of folderId
    const lineage = await this.getFolderLineage(newParentId);
    return lineage.some(folder => folder.id === folderId);
  }

  /**
   * Update folder metadata (collection_count, total_items)
   */
  async updateFolderMetadata(folderId) {
    // Count direct collections
    const collectionCount = await this.db.get(
      'SELECT COUNT(*) as count FROM collections WHERE folder_id = ? AND archived = 0',
      [folderId]
    );

    // Count total items across all collections in this folder
    const totalItems = await this.db.get(
      'SELECT SUM(item_count) as total FROM collections WHERE folder_id = ? AND archived = 0',
      [folderId]
    );

    await this.db.run(
      'UPDATE folders SET collection_count = ?, total_items = ? WHERE id = ?',
      [collectionCount.count, totalItems.total || 0, folderId]
    );
  }

  /**
   * Archive/unarchive folder
   */
  async archiveFolder(folderId, archived = true) {
    await this.db.run(
      'UPDATE folders SET archived = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [archived ? 1 : 0, folderId]
    );
  }
}

module.exports = FolderManager;
